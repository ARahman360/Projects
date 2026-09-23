export type SortOption = "recommended" | "price-low" | "price-high" | "rating" | "fastest" | "nearest";

export function normalizeCatalogSearchText(value: string) {
  return value.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fi-FI")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}
export type FilterableDish = {
  id: number;
  name: string;
  shop: string;
  cuisine: string;
  category: string;
  description: string;
  price: number;
  rating: number | null;
  estimatedMinutes?: number | null;
  deliveryDistanceKm?: number | null;
  deliveryFee: number;
  orderCount?: number;
  favoriteCount?: number;
  isFeatured?: boolean;
};

export type DishFilters = { query?: string; category?: string; under30?: boolean; topRated?: boolean; freeDelivery?: boolean; sort?: SortOption };

const categoryAliases: Record<string, string[]> = {
  Bangladeshi: ["bangladeshi", "bangla", "bengali", "bhuna", "khichuri"],
  Indian: ["indian", "masala", "curry", "tikka"],
  Biryani: ["biryani", "pulao", "pilaf"],
  Beef: ["beef", "bhuna"],
  Chicken: ["chicken", "murgh"],
  Vegetarian: ["vegetarian", "veggie", "paneer", "lentil", "dal", "khichuri"],
  Desserts: ["dessert", "sweet", "cake", "pudding", "mishti"],
};

export function filterAndSortDishes<T extends FilterableDish>(dishes: readonly T[], filters: DishFilters): T[] {
  const query = normalizeCatalogSearchText(filters.query ?? "");
  const category = filters.category ?? "All";
  const aliases = category === "All" ? [] : categoryAliases[category] ?? [category.toLocaleLowerCase()];
  return dishes.filter((dish) => {
    const categoryText = normalizeCatalogSearchText(`${dish.category} ${dish.name} ${dish.description} ${dish.cuisine}`);
    const searchText = normalizeCatalogSearchText(`${dish.name} ${dish.shop} ${dish.cuisine} ${dish.description}`);
    return (!aliases.length || aliases.some((alias) => categoryText.includes(alias)))
      && (!query || searchText.includes(query))
      && (!filters.under30 || dish.estimatedMinutes != null && dish.estimatedMinutes < 30)
      && (!filters.freeDelivery || dish.deliveryFee === 0)
      && (!filters.topRated || dish.rating != null && dish.rating >= 4.5);
  }).sort((a, b) => {
    switch (filters.sort ?? "recommended") {
      case "price-low": return a.price - b.price || a.id - b.id;
      case "price-high": return b.price - a.price || a.id - b.id;
      case "rating": return (b.rating ?? -1) - (a.rating ?? -1) || a.id - b.id;
      case "fastest": return (a.estimatedMinutes ?? Number.MAX_SAFE_INTEGER) - (b.estimatedMinutes ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;
      case "nearest": return (a.deliveryDistanceKm ?? Number.MAX_SAFE_INTEGER) - (b.deliveryDistanceKm ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;
      case "recommended":
      default: {
        const relevance = (dish: T) => {
          if (!query) return 0;
          const name = dish.name.toLocaleLowerCase();
          if (name === query) return 3;
          if (name.startsWith(query)) return 2;
          if (name.includes(query)) return 1;
          return 0;
        };
        return relevance(b) - relevance(a) || Number(b.isFeatured) - Number(a.isFeatured) || (b.orderCount ?? 0) - (a.orderCount ?? 0) || (b.favoriteCount ?? 0) - (a.favoriteCount ?? 0) || (b.rating ?? -1) - (a.rating ?? -1) || a.id - b.id;
      }
    }
  });
}
