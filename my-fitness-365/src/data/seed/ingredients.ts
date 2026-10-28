import type { IngredientCategory, Ingredient } from '../types'

export type IngredientSeed = Pick<
  Ingredient,
  'key' | 'name' | 'category' | 'kcal' | 'protein' | 'carbs' | 'fat' | 'fibre' | 'state'
>

/**
 * Per-100g values. These are rounded TYPICAL values of the kind printed on UK
 * supermarket labels, entered by hand as estimates — they are NOT drawn from a
 * verified food-composition dataset (e.g. CoFID) and are not lab-accurate.
 * Brands vary; edit any value in the app.
 */
export const INGREDIENT_SOURCE = 'Estimate — typical UK label values (unverified)'

const M: IngredientCategory = 'Meat and fish'
const V: IngredientCategory = 'Vegetables'
const F: IngredientCategory = 'Fruit'
const D: IngredientCategory = 'Dairy and eggs'
const G: IngredientCategory = 'Rice, pasta and grains'
const T: IngredientCategory = 'Tinned and packaged food'
const H: IngredientCategory = 'Herbs, spices and sauces'
const O: IngredientCategory = 'Other'

const i = (
  key: string,
  name: string,
  category: IngredientCategory,
  state: IngredientSeed['state'],
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fibre: number,
): IngredientSeed => ({ key, name, category, state, kcal, protein, carbs, fat, fibre })

export const INGREDIENTS: IngredientSeed[] = [
  // Meat and fish
  i('chicken_breast', 'Chicken breast fillets', M, 'raw', 106, 24, 0, 1.1, 0),
  i('chicken_thigh', 'Skinless chicken thigh fillets', M, 'raw', 145, 19, 0, 7.5, 0),
  i('cooked_chicken', 'Cooked chicken breast pieces', M, 'as sold', 150, 31, 0.5, 2.5, 0),
  i('turkey_mince', 'Turkey breast mince (5% fat)', M, 'raw', 130, 21, 0, 5, 0),
  i('turkey_slices', 'Sliced turkey breast', M, 'as sold', 105, 23, 1, 1, 0),
  i('salmon', 'Salmon fillets', M, 'raw', 200, 20, 0, 13, 0),
  i('tuna_tin', 'Tuna chunks in spring water (drained)', M, 'as sold', 110, 25, 0, 1, 0),
  // Dairy and eggs
  i('eggs', 'Eggs (large)', D, 'raw', 131, 12.6, 0.1, 9, 0),
  i('greek_yoghurt', 'Fat-free Greek-style yoghurt', D, 'as sold', 57, 10, 3.6, 0.2, 0),
  i('protein_yoghurt', 'High-protein yoghurt', D, 'as sold', 63, 10, 5.5, 0.2, 0),
  i('milk_semi', 'Semi-skimmed milk', D, 'as sold', 47, 3.5, 4.8, 1.7, 0),
  i('cheddar_light', 'Reduced-fat cheddar', D, 'as sold', 314, 28, 0.1, 22, 0),
  i('feta', 'Feta cheese', D, 'as sold', 250, 16, 1.5, 20, 0),
  i('cottage_cheese', 'Low-fat cottage cheese', D, 'as sold', 72, 12, 3, 1.5, 0),
  // Grains, bread, rice, pasta
  i('oats', 'Porridge oats', G, 'dry', 375, 11, 60, 8, 9),
  i('bread_wholemeal', 'Wholemeal bread', G, 'as sold', 230, 10, 39, 2.5, 7),
  i('wrap_wholemeal', 'Wholemeal tortilla wraps', G, 'as sold', 290, 9, 47, 6, 5),
  i('rice_basmati', 'Basmati rice', G, 'dry', 355, 8, 78, 1, 1),
  i('pasta', 'Wholewheat pasta', G, 'dry', 340, 13, 64, 2.5, 9),
  i('rice_cakes', 'Rice cakes', G, 'as sold', 380, 8, 79, 3, 3),
  // Vegetables
  i('potatoes', 'White potatoes', V, 'raw', 75, 2, 16, 0.2, 1.5),
  i('baby_potatoes', 'Baby new potatoes', V, 'raw', 75, 1.7, 16, 0.3, 1.5),
  i('sweet_potato', 'Sweet potatoes', V, 'raw', 86, 1.6, 20, 0.1, 3),
  i('broccoli', 'Broccoli', V, 'raw', 34, 4, 3, 0.6, 2.6),
  i('carrots', 'Carrots', V, 'raw', 34, 0.6, 7.9, 0.3, 2.4),
  i('green_beans', 'Green beans', V, 'raw', 25, 1.9, 3.2, 0.5, 3),
  i('peppers', 'Mixed peppers', V, 'raw', 30, 1, 5.5, 0.3, 1.6),
  i('onion', 'Onions', V, 'raw', 36, 1.2, 7.9, 0.2, 1.4),
  i('red_onion', 'Red onions', V, 'raw', 36, 1.2, 7.9, 0.2, 1.4),
  i('courgette', 'Courgettes', V, 'raw', 18, 1.8, 1.8, 0.4, 1),
  i('mushrooms', 'Mushrooms', V, 'raw', 13, 1.8, 0.4, 0.5, 1.1),
  i('spinach', 'Baby spinach', V, 'raw', 25, 2.8, 1.6, 0.8, 2.1),
  i('salad_leaves', 'Mixed salad leaves', V, 'raw', 15, 1.4, 1.7, 0.3, 1.3),
  i('tomatoes', 'Tomatoes', V, 'raw', 18, 0.7, 3.1, 0.3, 1),
  i('cherry_tomatoes', 'Cherry tomatoes', V, 'raw', 18, 0.7, 3.1, 0.3, 1),
  i('cucumber', 'Cucumber', V, 'raw', 12, 0.7, 1.5, 0.1, 0.6),
  i('stir_fry_veg', 'Stir-fry vegetable mix', V, 'raw', 30, 1.8, 4, 0.3, 2),
  i('frozen_peas', 'Frozen peas', V, 'raw', 66, 5.5, 9.7, 0.9, 5.1),
  i('garlic', 'Garlic', V, 'raw', 98, 7.9, 16, 0.6, 4),
  i('avocado', 'Avocado', V, 'raw', 190, 1.9, 1.9, 19.5, 3.4),
  // Fruit
  i('banana', 'Bananas (peeled weight)', F, 'raw', 95, 1.2, 20.3, 0.3, 1.4),
  i('berries', 'Mixed berries (fresh or frozen)', F, 'raw', 45, 0.9, 8, 0.3, 3.5),
  i('apple', 'Apples', F, 'raw', 50, 0.4, 11.8, 0.1, 1.8),
  i('lemon', 'Lemons (juice)', F, 'raw', 7, 0.3, 1.6, 0, 0.1),
  // Tinned and packaged
  i('chopped_tomatoes', 'Chopped tomatoes (tin)', T, 'as sold', 22, 1, 3.6, 0.2, 1),
  i('kidney_beans', 'Kidney beans (tin, drained)', T, 'as sold', 100, 7, 15, 0.5, 6),
  i('sweetcorn', 'Sweetcorn (tin, drained)', T, 'as sold', 79, 2.9, 15, 1.2, 1.4),
  i('coconut_milk_light', 'Light coconut milk', T, 'as sold', 73, 0.7, 2.3, 7, 0),
  i('chicken_soup', 'Fresh chicken soup (carton)', T, 'as sold', 45, 2.5, 4.5, 1.8, 0.5),
  i('chicken_stock', 'Chicken stock (made up)', T, 'as sold', 5, 0.3, 0.5, 0.2, 0),
  i('peanut_butter', 'Peanut butter', T, 'as sold', 597, 25, 13, 50, 6),
  i('almonds', 'Almonds', T, 'as sold', 612, 21, 7, 55, 7.4),
  i('hummus', 'Reduced-fat hummus', T, 'as sold', 250, 7.5, 12, 18, 5),
  i('whey', 'Whey protein powder', T, 'as sold', 380, 75, 8, 6, 0),
  i('honey', 'Honey', T, 'as sold', 330, 0.4, 81, 0, 0),
  // Herbs, spices, sauces, oils
  i('olive_oil', 'Olive oil', H, 'as sold', 899, 0, 0, 99.9, 0),
  i('cajun', 'Cajun seasoning', H, 'as sold', 300, 10, 50, 6, 10),
  i('fajita', 'Fajita seasoning', H, 'as sold', 300, 10, 50, 6, 10),
  i('curry_paste', 'Curry paste (tikka/korma style)', H, 'as sold', 250, 4, 12, 20, 4),
  i('soy_sauce', 'Reduced-salt soy sauce', H, 'as sold', 60, 7, 6, 0.1, 0),
  i('mixed_herbs', 'Dried mixed herbs', H, 'as sold', 260, 9, 40, 6, 30),
  i('paprika', 'Smoked paprika', H, 'as sold', 280, 14, 34, 13, 35),
  i('chilli_powder', 'Mild chilli powder', H, 'as sold', 280, 13, 33, 14, 35),
  i('salsa', 'Tomato salsa', H, 'as sold', 40, 1.5, 7, 0.3, 1.2),
  i('light_mayo', 'Light mayonnaise', H, 'as sold', 290, 0.7, 7, 28.8, 0),
  i('balsamic', 'Balsamic vinegar', H, 'as sold', 90, 0.5, 17, 0, 0),
  // Other
  i('stock_cube', 'Chicken stock cubes', O, 'as sold', 250, 10, 20, 15, 0),
]
