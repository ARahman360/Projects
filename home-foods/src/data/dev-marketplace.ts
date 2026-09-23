export type MenuSeed = { name: string; price: number; category: string };
export type CuisineSeed = { key: string; cuisine: string; description: string; dishes: MenuSeed[]; photos: string[] };

const photos = {
  curry: ["https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=900&q=85"],
  rice: ["https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=900&q=85"],
  noodles: ["https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=900&q=85"],
  grill: ["https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85"],
  veg: ["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=85"],
  dessert: ["https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=85", "https://images.unsplash.com/photo-1551024506-0cc1eea20f3f?auto=format&fit=crop&w=900&q=85"],
  pizza: ["https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=900&q=85"],
};

function menu(key: string, names: string, categories: string[], base: number, imageSet: keyof typeof photos): CuisineSeed {
  const chooseCategory = (name: string, index: number) => {
    const lower = name.toLowerCase();
    const has = (...words: string[]) => words.some((word) => word.includes(" ") ? lower.includes(word) : new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}\\b`, "i").test(lower));
    const find = (...words: string[]) => categories.find((category) => words.some((word) => category.toLowerCase().includes(word)));
    if (has("tea", "coffee", "lassi", "juice", "drink", "soda", "smoothie", "milkshake", "lemonade", "water", "mocktail")) return find("drink") ?? "Drinks";
    if (has("cake", "pie", "tart", "pudding", "baklava", "firni", "kheer", "jamun", "roshogolla", "kunafa", "kunefe", "mochi", "bingsu", "churros", "dessert", "sweet", "ice cream", "halwa", "cheesecake", "cannoli", "tiramisu", "mämmi", "korvapuusti", "msemen with honey", "yomari", "yogurt honey")) return find("dessert", "sweet", "dolci", "sweets", "bakes") ?? categories[categories.length - 1];
    if (has("soup", "stew", "pho ", "ramen", "thukpa", "chowder", "jiggae")) return find("soup", "noodle", "pho", "stew") ?? categories[0];
    if (has("salad", "tabbouleh", "fattoush", "kachumber", "slaw")) return find("salad", "starter", "mezze") ?? categories[0];
    if (has("naan", "roti", "bread", "pita", "paratha", "focaccia", "manakish", "flatbread", "simit", "lavash", "injera", "khobz", "batbout")) return find("bread", "side", "injera") ?? categories[0];
    if (has("biryani", "polao", "pulao", "polo ", "donburi", "rice", "khichuri", "khichdi", "risotto", "pulao", "fried rice")) return find("rice", "biryani", "bowl", "meal prep") ?? categories[0];
    if (has("noodle", "pasta", "spaghetti", "linguine", "lasagne", "lasagna", "gnocchi", "ravioli", "mac and cheese", "soba", "udon", "chow mein", "ho fun")) return find("noodle", "pasta", "main") ?? categories[0];
    if (has("kebab", "kabab", "grill", "tandoori", "tikka", "shish", "souvlaki", "shawarma", "burger", "brisket", "barbecue", "bbq", "steak", "tibs", "sek ea", "suya")) return find("grill", "barbecue", "bbq", "main") ?? categories[0];
    if (has("samosa", "spring roll", "dumpling", "momo", "gyoza", "wonton", "tempura", "bhaji", "pakora", "bruschetta", "arancini", "briouat", "borek", "toast", "skewer", "satay", "pani puri", "tostada", "taco", "quesadilla", "wrap", "manakish")) return find("starter", "street", "small", "mezze", "momo", "dim sum", "taco", "wrap") ?? categories[0];
    if (has("side", "fries", "potato", "rice &", "extra", "pickle", "chutney", "raita", "sauce", "olives", "hummus", "dip", "bread &")) return find("side", "bread", "mezze") ?? categories[0];
    if (has("vegan", "vegetarian", "tofu", "vegetable", "lentil", "bean", "chickpea", "aubergine", "eggplant", "paneer")) return find("vegetarian", "vegan", "plant", "bowl") ?? find("main", "curry", "wat", "mains") ?? categories[0];
    return find("main", "curry", "wat", "mains", "bowl", "grill", "traditional") ?? categories[index % categories.length];
  };
  const dishes = names.split("|").map((rawName, i) => {
    const name = rawName.trim();
    const category = chooseCategory(name, i);
    const lower = name.toLowerCase();
    const match = (...words: string[]) => words.some((word) => word.includes(" ") ? lower.includes(word) : new RegExp(`\\b${word}\\b`, "i").test(lower));
    const price = match("tea", "coffee", "juice", "drink", "soda", "smoothie", "lassi", "lemonade", "mocktail", "milkshake") ? 2.5 + (i % 5) * 0.6
      : match("cake", "pie", "tart", "pudding", "baklava", "firni", "kheer", "jamun", "roshogolla", "kunafa", "kunefe", "mochi", "bingsu", "churros", "sweet", "ice cream", "halwa", "cheesecake", "cannoli", "tiramisu", "mämmi", "korvapuusti") ? 4 + (i % 5) * 0.85
        : match("family", "platter", "royale", "feast", "bowl") ? 17 + (i % 6) * 2.3
          : match("salad", "side", "bread", "naan", "roti", "pita", "paratha", "fries", "rice", "soup", "starter", "samosa", "roll", "dumpling") ? 4 + (i % 6) * 0.9
            : base + (i % 7) * 1.35 + (i % 3) * 0.4;
    return { name, price: Math.round(price * 100) / 100, category };
  });
  if (dishes.length !== 30) throw new Error(`${key} must define exactly 30 menu dishes`);
  return { key, cuisine: key, description: `A fictional development menu inspired by ${key} home cooking. Contact the kitchen to confirm ingredients and allergens.`, dishes, photos: photos[imageSet] };
}

// Curated dishes are genuine menu ideas. Restaurants in the same cuisine may
// share popular dishes, as real marketplaces do; each shop still gets its own
// records, category links, availability and featured selections.
export const cuisineMenus: Record<string, CuisineSeed> = {
  bangla: menu("Bangladeshi", "Beef Bhuna|Chicken Curry|Chicken Roast|Rui Fish Curry|Hilsa Curry|Masoor Dal|Mixed Seasonal Vegetables|Beef Kala Bhuna|Bhuna Khichuri|Steamed Basmati Rice|Shahi Polao|Paratha|Begun Bharta|Aloo Bhorta|Shorshe Ilish|Chingri Malai Curry|Chicken Korma|Beef Tehari|Firni|Jali Kebab|Morog Polao|Lau Chingri|Shutki Bhorta|Dal Puri|Cholar Dal|Prawn Bhuna|Vegetable Khichuri|Mutton Rezala|Borhani|Roshogolla", ["Homestyle mains", "Rice & khichuri", "Sides", "Desserts", "Drinks"], 6.5, "curry"),
  biryani: menu("Old Dhaka", "Kacchi Biryani|Chicken Biryani|Beef Tehari|Morog Polao|Shahi Polao|Mutton Biryani|Beef Biryani|Chicken Roast|Jali Kebab|Seekh Kebab|Beef Rezala|Borhani|Firni|Chicken Chaap|Mutton Chaap|Kabab Platter|Aloo Bukhara Biryani|Egg Biryani|Plain Polao|Beef Chap|Shami Kebab|Chicken Tikka|Basmati Rice|Cucumber Raita|Green Salad|Lacchi|Jorda Rice|Zafrani Kheer|Chicken Reshmi Kebab|Mutton Korma", ["Biryani & rice", "Kebabs", "Sides", "Desserts", "Drinks"], 7, "rice"),
  indian: menu("Indian", "Butter Chicken|Chicken Tikka Masala|Palak Paneer|Dal Makhani|Chana Masala|Samosa|Garlic Naan|Butter Naan|Chicken Biryani|Tandoori Chicken|Paneer Makhani|Aloo Gobi|Saag Aloo|Lamb Rogan Josh|Chicken Korma|Baingan Bharta|Jeera Rice|Vegetable Pulao|Pani Puri|Onion Bhaji|Tandoori Roti|Malai Kofta|Fish Curry|Mango Lassi|Gulab Jamun|Kheer|Pav Bhaji|Masala Dosa|Idli Sambar|Medu Vada", ["Curries", "Vegetarian", "Rice & bread", "Starters", "Desserts"], 5.5, "curry"),
  pakistan: menu("Pakistani", "Chicken Karahi|Lamb Karahi|Nihari|Haleem|Chapli Kebab|Seekh Kebab|Chicken Biryani|Beef Pulao|Chicken Handi|Beef Korma|Daal Chawal|Aloo Gosht|Saag Gosht|Chicken Tikka|Malai Boti|Reshmi Kebab|Tandoori Roti|Garlic Naan|Sheermal|Chana Masala|Pakora|Samosa Chaat|Raita|Kachumber Salad|Zarda|Shahi Tukray|Falooda|Mango Lassi|Doodh Patti Chai|Kheer", ["Curries", "Rice", "Grill", "Bread & sides", "Sweets"], 6, "grill"),
  nepal: menu("Nepalese", "Chicken Momo|Buff Momo|Vegetable Momo|Jhol Momo|C-Momo|Thukpa|Chicken Thukpa|Vegetable Thukpa|Dal Bhat Tarkari|Chicken Sekuwa|Pork Sekuwa|Choila|Chatamari|Yomari|Aloo Tama|Kwati Soup|Gundruk Soup|Sel Roti|Bara|Chow Mein Nepali|Chicken Curry Nepali|Mutton Curry Nepali|Saag Bhaji|Jeera Rice|Aloo Sadeko|Sukuti|Chilli Momo|Paneer Momo|Masala Chiya|Lassi", ["Momo", "Noodles & soup", "Traditional mains", "Sides", "Drinks"], 5.5, "noodles"),
  turkish: menu("Turkish", "Adana Kebab|Iskender Kebab|Chicken Shish|Lamb Shish|Lahmacun|Mixed Pide|Sucuklu Pide|Mercimek Soup|Ezogelin Soup|Hummus|Baba Ghanoush|Cacik|Sigara Boregi|Imam Bayildi|Kofte|Lamb Doner Plate|Chicken Doner Plate|Ali Nazik|Menemen|Turkish Salad|Bulgur Pilaf|Lavas Bread|Simit|Grilled Halloumi|Kunefe|Baklava|Sutlac|Ayran|Turkish Tea|Grilled Vegetable Plate", ["Mezze", "Grill", "Pide & bread", "Desserts", "Drinks"], 5.5, "grill"),
  italian: menu("Italian", "Spaghetti Carbonara|Lasagne al Forno|Tagliatelle Bolognese|Penne Arrabbiata|Fettuccine Alfredo|Mushroom Risotto|Caprese Salad|Margherita Pizza|Gnocchi al Pesto|Ravioli Ricotta Spinach|Chicken Parmigiana|Eggplant Parmigiana|Puttanesca Pasta|Cacio e Pepe|Seafood Linguine|Pesto Genovese Pasta|Minestrone|Bruschetta|Arancini|Polenta Funghi|Osso Buco|Insalata di Rucola|Garlic Focaccia|Calamari Fritti|Burrata & Tomatoes|Tiramisu|Panna Cotta|Cannoli|Affogato|Lemon Soda", ["Pasta", "Pizza & mains", "Starters", "Salads & sides", "Dolci"], 7, "pizza"),
  chinese: menu("Chinese", "Beef Chow Mein|Dan Dan Noodles|Mapo Tofu|Kung Pao Chicken|Sweet and Sour Pork|Vegetable Fried Rice|Yangzhou Fried Rice|Beef Ho Fun|Xiao Long Bao|Pork Dumplings|Spring Rolls|Scallion Pancakes|Sichuan Wontons|Hot and Sour Soup|Egg Drop Soup|Twice Cooked Pork|Sichuan Boiled Fish|Mongolian Beef|Char Siu|Chicken in Black Bean Sauce|Garlic Bok Choy|Chilli Oil Cucumber|Orange Chicken|Salt and Pepper Tofu|Prawn Toast|Congee with Chicken|Ma Po Aubergine|Steamed Jasmine Rice|Sesame Balls|Bubble Milk Tea", ["Wok & mains", "Noodles & rice", "Dim sum", "Sides", "Desserts & drinks"], 6, "noodles"),
  japanese: menu("Japanese", "Chicken Teriyaki Bento|Salmon Bento|Katsu Curry|Beef Donburi|Chicken Karaage|Miso Soup|Pork Gyoza|Edamame|Tonkotsu Ramen|Shoyu Ramen|Vegetable Ramen|Tempura Prawn|Vegetable Tempura|Salmon Nigiri Set|California Roll|Spicy Tuna Roll|Chicken Yakitori|Unagi Don|Okonomiyaki|Takoyaki|Onigiri Salmon|Tofu Katsu|Soba Noodle Salad|Chirashi Bowl|Agedashi Tofu|Japanese Curry Rice|Tamagoyaki|Seaweed Salad|Mochi Trio|Matcha Latte", ["Bento & bowls", "Ramen & noodles", "Small plates", "Sushi", "Desserts & drinks"], 6.5, "rice"),
  korean: menu("Korean", "Beef Bibimbap|Chicken Bibimbap|Vegetable Bibimbap|Bulgogi Beef Bowl|Spicy Pork Bulgogi|Korean Fried Chicken|Dakgangjeong|Kimchi Jjigae|Doenjang Jjigae|Tteokbokki|Japchae|Mandu Dumplings|Haemul Pajeon|Kimchi Jeon|Korean BBQ Short Ribs|Samgyeopsal Set|Budae Jjigae|Gimbap|Korean Glass Noodles|Soy Garlic Wings|Gochujang Tofu|Steamed Egg Gyeran-jjim|Kimchi Fried Rice|Korean Corn Cheese|Seaweed Soup|Cucumber Kimchi|Pickled Radish|Hotteok|Bingsu|Yuja Tea", ["Rice bowls", "Korean BBQ", "Stews & noodles", "Street food", "Sides & sweets"], 6, "rice"),
  thai: menu("Thai", "Pad Thai|Pad See Ew|Green Curry Chicken|Red Curry Tofu|Massaman Beef Curry|Panang Curry|Tom Yum Goong|Tom Kha Gai|Thai Basil Chicken|Pad Kra Pao|Pineapple Fried Rice|Mango Sticky Rice|Som Tum Papaya Salad|Larb Gai|Chicken Satay|Thai Fish Cakes|Crispy Spring Rolls|Drunken Noodles|Khao Soi|Thai Omelette Rice|Cashew Chicken|Coconut Rice|Vegetable Pad Woon Sen|Grilled Pork Neck|Laab Tofu|Yum Woon Sen|Thai Crab Fried Rice|Roti with Condensed Milk|Thai Iced Tea|Coconut Ice Cream", ["Curry", "Noodles & rice", "Street food", "Salads & starters", "Desserts & drinks"], 6, "noodles"),
  vietnamese: menu("Vietnamese", "Pho Bo|Pho Ga|Bun Bo Hue|Bun Cha Hanoi|Banh Mi Thit|Banh Mi Tofu|Goi Cuon Prawn Rolls|Cha Gio|Bun Thit Nuong|Com Tam Pork|Lemongrass Chicken Rice|Caramelised Pork Bowl|Banh Xeo|Vietnamese Shaking Beef|Canh Chua Fish Soup|Cao Lau Noodles|Mi Quang|Bun Rieu|Bo Kho Beef Stew|Green Papaya Salad|Vietnamese Egg Coffee|Fresh Tofu Summer Rolls|Grilled Pork Skewers|Chicken Congee|Sticky Rice with Mung Bean|Lotus Root Salad|Prawn Paste Sugarcane|Steamed Rice|Che Ba Mau|Vietnamese Iced Coffee", ["Pho & soup", "Rice & noodle bowls", "Banh mi", "Small plates", "Desserts & drinks"], 5.5, "noodles"),
  mexican: menu("Mexican", "Carne Asada Tacos|Chicken Tinga Tacos|Baja Fish Tacos|Mushroom Tacos|Barbacoa Burrito|Chicken Burrito Bowl|Pork Carnitas Quesadilla|Cheese Quesadilla|Enchiladas Verdes|Chicken Mole|Chiles Rellenos|Pozole Rojo|Birria Tacos|Elote Street Corn|Guacamole & Totopos|Pico de Gallo|Chilaquiles|Huevos Rancheros|Tostadas de Tinga|Sopa de Tortilla|Fajita Platter|Mexican Rice|Refried Black Beans|Tamales|Cochinita Pibil|Ceviche Tostada|Churros|Tres Leches Cake|Horchata|Agua de Jamaica", ["Tacos & street food", "Burritos & bowls", "Mains", "Sides", "Desserts & drinks"], 6, "grill"),
  american: menu("American", "Classic Cheeseburger|Double Smash Burger|BBQ Bacon Burger|Spicy Chicken Burger|Black Bean Veggie Burger|Crispy Chicken Sandwich|Pulled Pork Sandwich|Texas Brisket Plate|Smoked Beef Ribs|Mac and Cheese|Loaded Fries|Onion Rings|Buffalo Wings|Chicken Tenders|Grilled Cheese Sandwich|New York Hot Dog|Clam Chowder|Caesar Chicken Salad|Cornbread|Coleslaw|BBQ Baked Beans|Buttermilk Pancakes|Buttermilk Biscuits & Gravy|Fried Chicken Plate|Philly Cheesesteak|Apple Pie|New York Cheesecake|Chocolate Milkshake|Vanilla Milkshake|Root Beer Float", ["Burgers & sandwiches", "BBQ & mains", "Sides", "Salads", "Desserts & shakes"], 7, "grill"),
  lebanese: menu("Lebanese", "Chicken Shawarma Plate|Beef Shawarma Wrap|Falafel Wrap|Mixed Grill Platter|Kafta Kebab|Shish Tawook|Hummus Beiruti|Baba Ghanoush|Tabbouleh|Fattoush|Mujaddara|Warak Enab|Kibbeh|Sfiha|Manakish Zaatar|Manakish Cheese|Batata Harra|Lentil Soup|Moutabal|Labneh & Olives|Grilled Halloumi|Chicken Musakhan|Lamb Ouzi|Vermicelli Rice|Pita Bread|Pickled Turnips|Kunafa|Maamoul|Ayran|Mint Lemonade", ["Mezze", "Grills & wraps", "Mains", "Bread & sides", "Sweets & drinks"], 5.5, "grill"),
  greek: menu("Greek", "Chicken Souvlaki Pita|Pork Gyros Plate|Lamb Kleftiko|Moussaka|Pastitsio|Spanakopita|Tiropita|Greek Salad|Horiatiki Salad|Tzatziki & Pita|Fasolada|Saganaki|Dolmades|Keftedes|Chicken Gyro Bowl|Grilled Octopus|Baked Feta|Gigantes Plaki|Lemon Potatoes|Greek Meatballs|Soutzoukakia|Seafood Orzo|Prawn Saganaki|Halloumi Souvlaki|Pita Bread|Olive Tapenade|Baklava|Galaktoboureko|Greek Yogurt Honey|Frappé Coffee", ["Meze", "Gyros & grill", "Traditional mains", "Sides", "Desserts & drinks"], 6, "grill"),
  finnish: menu("Finnish", "Lohikeitto|Lihapullat & Mash|Karjalanpaisti|Makaronilaatikko|Kaalikääryleet|Poronkäristys|Paistettu Muikku|Hernekeitto|Kaalilaatikko|Karelian Pasties|Egg Butter|Rye Bread & Butter|Salmon Soup Family Pot|Finnish Meat Pie|Mushroom Barley Risotto|Creamy Salmon Pasta|Oven Pancake|Mustikkapiirakka|Korvapuusti|Runeberg Tart|Rice Porridge|Smoked Salmon Plate|New Potatoes & Dill|Beetroot Salad|Mämmi with Cream|Grilled Sausage & Mash|Lanttulaatikko|Pyttipannu|Cloudberry Yogurt|Berry Kissel", ["Finnish classics", "Fish & mains", "Soups", "Bakes & sides", "Desserts"], 7, "curry"),
  persian: menu("Persian", "Zereshk Polo ba Morgh|Ghormeh Sabzi|Fesenjan|Koobideh Kebab|Joojeh Kebab|Tahdig|Baghali Polo|Adas Polo|Dizi Abgoosht|Ash Reshteh|Mirza Ghasemi|Kashk-e Bademjan|Kuku Sabzi|Shirazi Salad|Mast-o-Khiar|Chelo Kebab Barg|Saffron Rice|Lamb Shank with Dill Rice|Sohan Asali|Chicken Saffron Stew|Sabzi Khordan|Dolmeh Barg|Persian Lentil Soup|Barbari Bread|Lavash & Feta|Grilled Tomato Kebab|Loobia Polo|Sholeh Zard|Faloodeh Shirazi|Persian Tea", ["Stews & mains", "Kebabs", "Rice", "Sides", "Sweets & drinks"], 6, "rice"),
  syrian: menu("Syrian", "Chicken Maqluba|Mansaf|Yalanji|Shish Barak|Fatteh Hummus|Kibbeh Bil Sanieh|Muhammara|Syrian Lentil Soup|Makdous|Aleppo Kebab|Lamb Ouzi|Shawarma Dajaj|Shish Tawook|Fattoush|Tabbouleh|Hummus with Pine Nuts|Baba Ghanoush|Sujuk Flatbread|Mujaddara Hamra|Freekeh with Chicken|Stuffed Zucchini|Warak Enab|Grilled Kofta|Saj Bread|Za'atar Manakish|Rice with Vermicelli|Halawet El Jibn|Maamoul Pistachio|Jallab|Tamarind Juice", ["Home-style mains", "Grill", "Mezze", "Bread & sides", "Sweets & drinks"], 6, "grill"),
  ethiopian: menu("Ethiopian", "Doro Wat|Misir Wat|Shiro Wat|Tibs|Kitfo|Gomen|Atakilt Wat|Beyaynetu Platter|Firfir|Dulet|Azifa Lentil Salad|Kik Alicha|Yetsom Firfir|Key Wat|Bozena Shiro|Quanta Firfir|Injera Roll|Ethiopian Beef Tibs|Chicken Tibs|Lamb Awaze Tibs|Fossolia|Timatim Salad|Tikil Gomen|Ethiopian Coffee Ceremony Set|Chechebsa|Genfo|Injera (extra)|Berbere Lentils|Tej Honey Drink|Spiced Ethiopian Tea", ["Wat & stews", "Tibs & grill", "Vegetarian", "Sides & injera", "Drinks"], 6, "veg"),
  nigerian: menu("Nigerian", "Jollof Rice & Chicken|Jollof Rice & Beef|Egusi Soup|Afang Soup|Efo Riro|Suya Beef Skewers|Pepper Soup|Ofada Rice & Ayamase|Pounded Yam & Egusi|Amala & Ewedu|Banga Soup|Okra Soup|Moi Moi|Akara|Puff Puff|Nigerian Fried Rice|Yam Porridge|Beans & Plantain|Asun Spicy Goat|Nkwobi|Peppered Snail|Grilled Tilapia & Plantain|Chicken Stew & Rice|Gizdodo|Abacha Salad|Edikaikong|Catfish Pepper Soup|Chin Chin|Zobo Hibiscus Drink|Chapman Mocktail", ["Rice & mains", "Soups & swallows", "Grill", "Sides", "Snacks & drinks"], 6, "rice"),
  moroccan: menu("Moroccan", "Chicken Tagine with Preserved Lemon|Lamb Tagine with Prunes|Vegetable Tagine|Couscous Royale|Tfaya Couscous|Harira Soup|Pastilla Chicken|Kefta Tagine|Lamb Mechoui|Zaalouk|Taktouka|Briouat Chicken|Briouat Almond|Moroccan Carrot Salad| zaalouk & Khobz|Rfissa|Seffa Medfouna|Merguez Sausage Plate|Chermoula Fish|Lamb Couscous|Chicken Brochettes|Beetroot Orange Salad|Batbout Sandwich|Khobz Bread|Maakouda Potato Cakes|Chebakia|Msemen with Honey|Sellou|Mint Tea|Avocado Almond Smoothie".replace(" zaalouk & Khobz", "Zaalouk with Khobz"), ["Tagines & couscous", "Grill", "Salads & starters", "Bread & sides", "Sweets & drinks"], 6, "rice"),
  plant: menu("Plant-based", "Roasted Aubergine Couscous Bowl|Harissa Chickpea Wrap|Falafel Grain Bowl|Lentil Walnut Kofta|Mushroom Shawarma Plate|Charred Cauliflower Tahini|Stuffed Vine Leaves|Tomato Olive Orzo|Vegan Moussaka|Chickpea Spinach Stew|Za'atar Roasted Carrots|Muhammara Flatbread|Lemon Herb Tabbouleh|Crispy Butter Bean Salad|Smoky Baba Ghanoush Plate|Vegan Mezze Board|Roasted Pepper Hummus Bowl|Apricot Almond Couscous|Sumac Potato Wedges|Grilled Vegetable Pita|White Bean Kale Soup|Red Lentil Mujaddara|Beet Hummus Wrap|Pomegranate Freekeh Salad|Coconut Rose Rice Pudding|Date Tahini Bites|Orange Blossom Semolina Cake|Mint Lemon Cooler|Ginger Hibiscus Tea|Seasonal Fruit Pot", ["Bowls & plates", "Wraps", "Mezze", "Sides", "Desserts & drinks"], 7, "veg"),
  healthy: menu("Healthy bowls", "Salmon Quinoa Power Bowl|Harissa Chicken Grain Bowl|Crispy Tofu Brown Rice Bowl|Roasted Vegetable Farro Bowl|Lemon Herb Chicken Salad|Miso Salmon Poke Bowl|Green Goddess Chickpea Bowl|Turkey Avocado Protein Box|Mediterranean Tuna Bowl|Sweet Potato Black Bean Bowl|Steak Edamame Rice Bowl|Ginger Sesame Soba Bowl|Cajun Shrimp Brown Rice|Greek Chicken Meal Prep|Lentil Beetroot Protein Salad|Egg & Avocado Breakfast Box|Overnight Oats Berry Cup|Chia Mango Yogurt Pot|Roasted Broccoli Hummus Bowl|Chicken Pesto Pasta Box|Tofu Satay Noodle Bowl|Quinoa Stuffed Peppers|Cottage Cheese Snack Box|Teriyaki Tempeh Bowl|Tuna White Bean Salad|Lemon Dill Salmon Box|Peanut Butter Oat Bites|Seasonal Fruit & Skyr|Green Smoothie|Cold Brew Protein Shake", ["Protein bowls", "Salads", "Meal prep", "Breakfast & snacks", "Drinks"], 8, "veg"),
};

export type KitchenSeed = { name: string; key: keyof typeof cuisineMenus; city: string; region: string; minutes: number; fee: number; minOrder: number; days: string };
const city = ["Lahti", "Helsinki", "Espoo", "Vantaa", "Tampere", "Turku"];
const seededKitchens: KitchenSeed[] = [
  { name: "Dhaka Home Kitchen", key: "bangla", city: city[0], region: "Päijät-Häme", minutes: 35, fee: 2.9, minOrder: 12, days: "Mon–Sat 10:30–20:30" },
  { name: "Old Dhaka Biryani House", key: "biryani", city: city[0], region: "Päijät-Häme", minutes: 40, fee: 2.5, minOrder: 15, days: "Daily 11:00–21:00" },
  { name: "Bengal Fish & Curry", key: "bangla", city: city[1], region: "Uusimaa", minutes: 45, fee: 3.9, minOrder: 15, days: "Tue–Sun 11:00–20:30" },
  { name: "Amma's Bangladeshi Kitchen", key: "bangla", city: city[2], region: "Uusimaa", minutes: 40, fee: 3.5, minOrder: 13, days: "Mon–Sat 11:00–20:00" },
  { name: "Mumbai Spice Kitchen", key: "indian", city: city[1], region: "Uusimaa", minutes: 35, fee: 2.9, minOrder: 12, days: "Daily 11:00–21:30" },
  { name: "Punjabi Tandoor House", key: "indian", city: city[3], region: "Uusimaa", minutes: 40, fee: 3.5, minOrder: 14, days: "Mon–Sun 11:00–21:00" },
  { name: "Chennai Dosa Corner", key: "indian", city: city[4], region: "Pirkanmaa", minutes: 35, fee: 2.9, minOrder: 10, days: "Tue–Sun 10:30–20:30" },
  { name: "Royal Indian Biryani", key: "indian", city: city[0], region: "Päijät-Häme", minutes: 40, fee: 2.5, minOrder: 15, days: "Daily 11:00–21:00" },
  { name: "Lahore Food Street", key: "pakistan", city: city[1], region: "Uusimaa", minutes: 45, fee: 3.9, minOrder: 15, days: "Daily 12:00–22:00" },
  { name: "Karachi BBQ Kitchen", key: "pakistan", city: city[4], region: "Pirkanmaa", minutes: 40, fee: 3.5, minOrder: 14, days: "Wed–Mon 12:00–21:00" },
  { name: "Himalayan Momo House", key: "nepal", city: city[0], region: "Päijät-Häme", minutes: 35, fee: 2.5, minOrder: 10, days: "Daily 11:00–20:30" },
  { name: "Kathmandu Curry Kitchen", key: "nepal", city: city[2], region: "Uusimaa", minutes: 40, fee: 3.5, minOrder: 12, days: "Tue–Sun 11:00–21:00" },
  { name: "Istanbul Grill House", key: "turkish", city: city[1], region: "Uusimaa", minutes: 40, fee: 3.5, minOrder: 14, days: "Daily 11:00–22:00" },
  { name: "Anatolian Home Kitchen", key: "turkish", city: city[0], region: "Päijät-Häme", minutes: 35, fee: 2.5, minOrder: 12, days: "Mon–Sat 11:00–20:30" },
  { name: "Nonna's Italian Kitchen", key: "italian", city: city[4], region: "Pirkanmaa", minutes: 35, fee: 2.9, minOrder: 12, days: "Daily 11:00–21:30" },
  { name: "Napoli Pizza House", key: "italian", city: city[1], region: "Uusimaa", minutes: 30, fee: 2.9, minOrder: 10, days: "Daily 11:00–23:00" },
  { name: "Shanghai Wok Kitchen", key: "chinese", city: city[1], region: "Uusimaa", minutes: 35, fee: 3.5, minOrder: 12, days: "Daily 11:00–21:30" },
  { name: "Sichuan Spice House", key: "chinese", city: city[4], region: "Pirkanmaa", minutes: 40, fee: 3.5, minOrder: 12, days: "Tue–Sun 11:00–21:00" },
  { name: "Tokyo Bento Kitchen", key: "japanese", city: city[1], region: "Uusimaa", minutes: 35, fee: 3.9, minOrder: 14, days: "Daily 11:00–21:00" },
  { name: "Osaka Ramen House", key: "japanese", city: city[5], region: "Varsinais-Suomi", minutes: 40, fee: 3.5, minOrder: 13, days: "Tue–Sun 11:00–21:30" },
  { name: "Seoul Street Kitchen", key: "korean", city: city[1], region: "Uusimaa", minutes: 35, fee: 3.5, minOrder: 12, days: "Daily 11:00–21:00" },
  { name: "Korean BBQ House", key: "korean", city: city[4], region: "Pirkanmaa", minutes: 45, fee: 3.5, minOrder: 15, days: "Wed–Mon 12:00–22:00" },
  { name: "Bangkok Thai Kitchen", key: "thai", city: city[1], region: "Uusimaa", minutes: 35, fee: 3.5, minOrder: 12, days: "Daily 11:00–21:00" },
  { name: "Thai Street Wok", key: "thai", city: city[0], region: "Päijät-Häme", minutes: 35, fee: 2.9, minOrder: 11, days: "Tue–Sun 11:00–20:30" },
  { name: "Saigon Pho House", key: "vietnamese", city: city[3], region: "Uusimaa", minutes: 40, fee: 3.5, minOrder: 12, days: "Daily 11:00–21:00" },
  { name: "Casa Mexicana", key: "mexican", city: city[4], region: "Pirkanmaa", minutes: 35, fee: 3.2, minOrder: 12, days: "Daily 11:00–21:30" },
  { name: "Mexico City Street Kitchen", key: "mexican", city: city[1], region: "Uusimaa", minutes: 35, fee: 3.5, minOrder: 12, days: "Tue–Sun 11:00–21:00" },
  { name: "Brooklyn Burger House", key: "american", city: city[1], region: "Uusimaa", minutes: 30, fee: 3.5, minOrder: 12, days: "Daily 11:00–23:00" },
  { name: "Texas BBQ Kitchen", key: "american", city: city[4], region: "Pirkanmaa", minutes: 50, fee: 3.9, minOrder: 18, days: "Thu–Sun 12:00–22:00" },
  { name: "Beirut Mezze House", key: "lebanese", city: city[1], region: "Uusimaa", minutes: 35, fee: 3.5, minOrder: 12, days: "Daily 11:00–21:00" },
  { name: "Athens Mediterranean Kitchen", key: "greek", city: city[2], region: "Uusimaa", minutes: 40, fee: 3.5, minOrder: 14, days: "Tue–Sun 11:00–21:00" },
  { name: "Finnish Home Kitchen", key: "finnish", city: city[0], region: "Päijät-Häme", minutes: 35, fee: 2.5, minOrder: 10, days: "Mon–Fri 10:30–19:30" },
  { name: "Helsinki Salmon House", key: "finnish", city: city[1], region: "Uusimaa", minutes: 35, fee: 3.5, minOrder: 14, days: "Daily 11:00–21:00" },
  { name: "Persian Rice & Grill", key: "persian", city: city[4], region: "Pirkanmaa", minutes: 40, fee: 3.5, minOrder: 14, days: "Daily 11:00–21:00" },
  { name: "Damascus Home Kitchen", key: "syrian", city: city[0], region: "Päijät-Häme", minutes: 40, fee: 2.9, minOrder: 12, days: "Mon–Sat 11:00–20:30" },
  { name: "Addis Ethiopian Kitchen", key: "ethiopian", city: city[1], region: "Uusimaa", minutes: 45, fee: 3.9, minOrder: 14, days: "Wed–Mon 12:00–21:00" },
  { name: "Lagos Jollof House", key: "nigerian", city: city[3], region: "Uusimaa", minutes: 45, fee: 3.5, minOrder: 13, days: "Tue–Sun 12:00–21:00" },
  { name: "Marrakech Moroccan Kitchen", key: "moroccan", city: city[5], region: "Varsinais-Suomi", minutes: 45, fee: 3.5, minOrder: 14, days: "Daily 11:00–21:00" },
  { name: "Mediterranean Vegan Kitchen", key: "plant", city: city[1], region: "Uusimaa", minutes: 35, fee: 3.5, minOrder: 12, days: "Daily 10:30–20:30" },
  { name: "Global Healthy Bowl Kitchen", key: "healthy", city: city[4], region: "Pirkanmaa", minutes: 35, fee: 3.5, minOrder: 12, days: "Mon–Sat 10:30–20:30" },
];

const testCities = [
  ["Lahti", "Päijät-Häme"], ["Helsinki", "Uusimaa"], ["Espoo", "Uusimaa"], ["Vantaa", "Uusimaa"],
  ["Tampere", "Pirkanmaa"], ["Turku", "Varsinais-Suomi"], ["Oulu", "North Ostrobothnia"],
  ["Jyväskylä", "Central Finland"], ["Kuopio", "North Savo"], ["Lappeenranta", "South Karelia"],
  ["Vaasa", "Ostrobothnia"], ["Rovaniemi", "Lapland"],
] as const;

// Deterministic fictional city areas for local radius tests. These are not seller
// addresses and must never be used to represent a real kitchen in production.
export const kitchens: KitchenSeed[] = seededKitchens.map((kitchen, index) => {
  const location = kitchen.name === "Helsinki Salmon House" ? testCities[1] : testCities[index % testCities.length];
  return { ...kitchen, city: location[0], region: location[1] };
});

const testCityCoordinates: Record<string, { latitude: number; longitude: number }> = {
  Lahti: { latitude: 60.9827, longitude: 25.6612 }, Helsinki: { latitude: 60.1699, longitude: 24.9384 },
  Espoo: { latitude: 60.2055, longitude: 24.6559 }, Vantaa: { latitude: 60.2934, longitude: 25.0378 },
  Tampere: { latitude: 61.4978, longitude: 23.7610 }, Turku: { latitude: 60.4518, longitude: 22.2666 },
  Oulu: { latitude: 65.0121, longitude: 25.4651 }, "Jyväskylä": { latitude: 62.2426, longitude: 25.7473 },
  Kuopio: { latitude: 62.8924, longitude: 27.6770 }, Lappeenranta: { latitude: 61.0587, longitude: 28.1887 },
  Vaasa: { latitude: 63.0951, longitude: 21.6165 }, Rovaniemi: { latitude: 66.5039, longitude: 25.7294 },
};

export function fictionalKitchenCoordinates(cityName: string, fixtureIndex: number) {
  const center = testCityCoordinates[cityName];
  if (!center) return null;
  const latitudeOffset = (((fixtureIndex * 7) % 9) - 4) * 0.0015;
  const longitudeOffset = (((fixtureIndex * 5) % 9) - 4) * 0.0017;
  return { latitude: center.latitude + latitudeOffset, longitude: center.longitude + longitudeOffset };
}

export const planSeeds = [
  { name: "Five weekday lunches", type: "WEEKLY" as const, price: 62, meals: 5, description: "Five freshly prepared weekday lunches. Menus rotate weekly; contact the kitchen about ingredients and allergens." },
  { name: "Seven home-style dinners", type: "WEEKLY" as const, price: 112, meals: 7, description: "A varied dinner for one each day, prepared by the kitchen. Schedule agreed after ordering." },
  { name: "Family table · 5 days", type: "WEEKLY" as const, price: 248, meals: 10, description: "Ten family portions across five days. Delivery days and substitutions are arranged with the kitchen." },
];
