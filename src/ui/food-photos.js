/**
 * Food photo catalog: curated, locally bundled CC0 Commons assets.
 * See art/food/SOURCES.json and catalog.json for per-photo rights/provenance.
 * Illustrations only: NEVER calculate or infer nutrition from these images.
 */
export const FOOD_PHOTOS = Object.freeze([
  {
    "id": "chicken",
    "label": "Grilled chicken",
    "keywords": [
      "chicken",
      "grilled chicken"
    ]
  },
  {
    "id": "yogurt-berries",
    "label": "Yogurt with strawberries",
    "keywords": [
      "yogurt berries",
      "greek yogurt berries",
      "strawberry yogurt"
    ]
  },
  {
    "id": "yogurt",
    "label": "Plain yogurt",
    "keywords": [
      "yogurt",
      "greek yogurt"
    ]
  },
  {
    "id": "salmon",
    "label": "Salmon meal",
    "keywords": [
      "salmon"
    ]
  },
  {
    "id": "salad",
    "label": "Vegetable salad",
    "keywords": [
      "salad"
    ]
  },
  {
    "id": "apple",
    "label": "Apples",
    "keywords": [
      "apple",
      "apples"
    ]
  },
  {
    "id": "banana",
    "label": "Bananas",
    "keywords": [
      "banana",
      "bananas"
    ]
  },
  {
    "id": "eggs",
    "label": "Egg on toast",
    "keywords": [
      "scrambled egg",
      "eggs",
      "egg"
    ]
  },
  {
    "id": "pizza",
    "label": "Cheese pizza",
    "keywords": [
      "pizza"
    ]
  },
  {
    "id": "burger",
    "label": "Hamburger",
    "keywords": [
      "hamburger",
      "burger"
    ]
  },
  {
    "id": "sandwich",
    "label": "Breakfast sandwich",
    "keywords": [
      "sandwich"
    ]
  },
  {
    "id": "fruit",
    "label": "Fruit salad",
    "keywords": [
      "fruit salad",
      "fruit bowl"
    ]
  },
  {
    "id": "strawberries",
    "label": "Strawberries",
    "keywords": [
      "strawberries",
      "strawberry"
    ]
  },
  {
    "id": "pasta",
    "label": "Spaghetti in a bowl",
    "keywords": [
      "pasta",
      "spaghetti",
      "noodles"
    ]
  },
  {
    "id": "steak",
    "label": "Steak",
    "keywords": [
      "steak",
      "beef steak"
    ]
  },
  {
    "id": "sushi",
    "label": "Sushi",
    "keywords": [
      "sushi"
    ]
  }
].map((row)=>Object.freeze({
  ...row,
  url: new URL('../../art/food/' + row.id + '.jpg', import.meta.url).href,
})))

export function matchingFoodPhoto(description) {
  const words=String(description??'').toLowerCase().match(/[a-z0-9]+/g)??[]
  let winning=null,score=0
  for(const photo of FOOD_PHOTOS) {
    for(const phrase of photo.keywords){
      const terms=phrase.toLowerCase().match(/[a-z0-9]+/g)??[]
      if(terms.length && terms.every(term=>words.includes(term))) {
        const rank=terms.length*10+terms.join(' ').length
        if(rank>score){winning=photo;score=rank}
      }
    }
  }
  return winning
}
