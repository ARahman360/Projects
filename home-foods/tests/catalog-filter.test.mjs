import test from "node:test";
import assert from "node:assert/strict";
import { filterAndSortDishes } from "../src/lib/catalog-filter.ts";

const dishes = [
  { id: 1, name: "Roast chicken", shop: "North Kitchen", cuisine: "Finnish", category: "Chicken", description: "Oven roasted", price: 13, rating: null, estimatedMinutes: null, deliveryFee: 2.5, deliveryDistanceKm: 6, orderCount: 2 },
  { id: 2, name: "Beef Bhuna", shop: "Spice Kitchen", cuisine: "Bangladeshi", category: "Beef", description: "Slow cooked beef", price: 5, rating: 4.8, estimatedMinutes: 20, deliveryFee: 0, deliveryDistanceKm: 3, orderCount: 6 },
  { id: 3, name: "Lentil soup", shop: "Green Kitchen", cuisine: "Indian", category: "Vegetarian", description: "Plant based", price: 9, rating: 4.5, estimatedMinutes: 40, deliveryFee: 0, deliveryDistanceKm: null, orderCount: 1 },
  { id: 4, name: "Chicken biryani", shop: "Rice Kitchen", cuisine: "Indian", category: "Biryani", description: "Fragrant rice", price: 22, rating: 5, estimatedMinutes: 25, deliveryFee: 0, deliveryDistanceKm: 10, isFeatured: true },
];

test("price sort is numerical in both directions", () => {
  assert.deepEqual(filterAndSortDishes(dishes, { sort: "price-low" }).map((dish) => dish.id), [2, 3, 1, 4]);
  assert.deepEqual(filterAndSortDishes(dishes, { sort: "price-high" }).map((dish) => dish.id), [4, 1, 3, 2]);
});

test("filters combine and exclude missing delivery estimates and ratings", () => {
  const idsFor = (filters) => filterAndSortDishes(dishes, filters).map((dish) => dish.id).sort((a, b) => a - b);
  assert.deepEqual(idsFor({ under30: true }), [2, 4]);
  assert.deepEqual(idsFor({ topRated: true }), [2, 3, 4]);
  assert.deepEqual(idsFor({ freeDelivery: true }), [2, 3, 4]);
  const result = filterAndSortDishes(dishes, { under30: true, topRated: true, freeDelivery: true, sort: "price-low" });
  assert.deepEqual(result.map((dish) => dish.id), [2, 4]);
});

test("nearest and fastest leave unknown measurements last", () => {
  assert.deepEqual(filterAndSortDishes(dishes, { sort: "nearest" }).map((dish) => dish.id), [2, 1, 4, 3]);
  assert.deepEqual(filterAndSortDishes(dishes, { sort: "fastest" }).map((dish) => dish.id), [2, 4, 3, 1]);
});

test("search and category remain active together", () => {
  assert.deepEqual(filterAndSortDishes(dishes, { query: "chicken", category: "Biryani" }).map((dish) => dish.id), [4]);
  assert.deepEqual(filterAndSortDishes(dishes, { query: "beef", category: "Chicken" }), []);
});

test("recommended search favors exact and name-prefix matches", () => {
  const result = filterAndSortDishes(dishes, { query: "chicken", sort: "recommended" });
  assert.deepEqual(result.map((dish) => dish.id), [4, 1]);
});
