import Foundation
import HealthKit

final class HealthKitBridge {
    static let shared = HealthKitBridge()

    private let store = HKHealthStore()

    private init() {}

    func requestAuthorization() async throws -> [String: Any] {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitBridgeError.unavailable
        }
        guard
            let steps = HKObjectType.quantityType(forIdentifier: .stepCount),
            let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)
        else {
            throw HealthKitBridgeError.typeUnavailable
        }

        try await store.requestAuthorization(
            toShare: Set<HKSampleType>(),
            read: Set<HKObjectType>([steps, sleep])
        )

        // HealthKit deliberately does not reveal whether read permission was
        // denied for an individual type. A successful request means only that
        // the authorization flow completed; reads may still return no samples.
        return ["authorized": true]
    }

    func read(dateKey: String) async throws -> [String: Any] {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthKitBridgeError.unavailable
        }
        guard let day = localDate(from: dateKey) else {
            throw HealthKitBridgeError.invalidDate
        }

        async let stepValue = steps(on: day)
        async let sleepValue = sleepHours(wakingOn: day)

        let (steps, sleepHours) = try await (stepValue, sleepValue)
        var payload: [String: Any] = ["date": dateKey]
        if let steps { payload["steps"] = steps }
        if let sleepHours { payload["sleepHours"] = sleepHours }
        return payload
    }

    private func steps(on day: Date) async throws -> Int? {
        guard let type = HKObjectType.quantityType(forIdentifier: .stepCount) else {
            throw HealthKitBridgeError.typeUnavailable
        }
        let calendar = Calendar.autoupdatingCurrent
        let start = calendar.startOfDay(for: day)
        guard let end = calendar.date(byAdding: .day, value: 1, to: start) else {
            throw HealthKitBridgeError.invalidDate
        }
        let predicate = HKQuery.predicateForSamples(
            withStart: start,
            end: end,
            options: [.strictStartDate]
        )

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: [.cumulativeSum]
            ) { _, statistics, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                guard let quantity = statistics?.sumQuantity() else {
                    continuation.resume(returning: nil)
                    return
                }
                continuation.resume(returning: Int(quantity.doubleValue(for: .count()).rounded()))
            }
            store.execute(query)
        }
    }

    /// Sleep is assigned to the date the user wakes up. Query noon-to-noon so a
    /// normal overnight sleep never gets split at midnight. We count only asleep
    /// stages, ignore in-bed/awake samples, then union overlapping intervals so
    /// duplicate stage/source samples cannot double-count time.
    private func sleepHours(wakingOn day: Date) async throws -> Double? {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            throw HealthKitBridgeError.typeUnavailable
        }
        let calendar = Calendar.autoupdatingCurrent
        guard
            let noon = calendar.date(bySettingHour: 12, minute: 0, second: 0, of: day),
            let start = calendar.date(byAdding: .day, value: -1, to: noon)
        else {
            throw HealthKitBridgeError.invalidDate
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: noon, options: [])
        let samples: [HKCategorySample] = try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, rawSamples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: (rawSamples as? [HKCategorySample]) ?? [])
            }
            store.execute(query)
        }

        let asleepValues: Set<Int> = [
            HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue,
            HKCategoryValueSleepAnalysis.asleepCore.rawValue,
            HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
            HKCategoryValueSleepAnalysis.asleepREM.rawValue,
        ]

        let intervals = samples
            .filter { asleepValues.contains($0.value) }
            .map { (max($0.startDate, start), min($0.endDate, noon)) }
            .filter { $0.1 > $0.0 }
            .sorted { $0.0 < $1.0 }

        guard var current = intervals.first else { return nil }
        var total: TimeInterval = 0
        for interval in intervals.dropFirst() {
            if interval.0 <= current.1 {
                if interval.1 > current.1 { current.1 = interval.1 }
            } else {
                total += current.1.timeIntervalSince(current.0)
                current = interval
            }
        }
        total += current.1.timeIntervalSince(current.0)

        let hours = total / 3600
        // Third-party summaries can still span most of a day. Do not replace a
        // good manual value with a physically implausible Health result.
        guard hours <= 16 else { return nil }
        return (hours * 100).rounded() / 100
    }

    private func localDate(from key: String) -> Date? {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var components = DateComponents()
        components.calendar = Calendar.autoupdatingCurrent
        components.timeZone = TimeZone.autoupdatingCurrent
        components.year = parts[0]
        components.month = parts[1]
        components.day = parts[2]
        components.hour = 12
        return components.date
    }
}

enum HealthKitBridgeError: LocalizedError {
    case unavailable
    case typeUnavailable
    case invalidDate

    var errorDescription: String? {
        switch self {
        case .unavailable: return "Health data is unavailable on this device."
        case .typeUnavailable: return "The requested HealthKit data type is unavailable."
        case .invalidDate: return "Tempered supplied an invalid calendar date."
        }
    }
}
