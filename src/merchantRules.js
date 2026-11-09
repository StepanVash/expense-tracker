/**
 * Built-in guesses for the category of a bank-statement line, by merchant name.
 * Used when the CSV has no category column and your earlier transactions don't help.
 * Based on the merchants in your Excel file, plus common Polish shops and services.
 *
 * `category` is matched against the NAMES of your categories (see defaultCategories.js);
 * if you renamed or deleted that category, the rule is simply ignored.
 * A word matches at the START of a word: "mcdonald" matches "McDonald's" and "MCDONALDS".
 */
export const MERCHANT_RULES = [
  // ----- expenses -----
  {
    category: 'Grocery',
    words: [
      'biedronka', 'lidl', 'zabka', 'podwawelska', 'piekarnia', 'carrefour', 'auchan', 'kaufland',
      'netto', 'dino', 'stokrotka', 'rossmann', 'aldi', 'tesco', 'delikatesy', 'spozywcz', 'lajkonik',
    ],
  },
  {
    category: 'Cafe & Entertainment',
    words: [
      'mcdonald', 'kfc', 'burger', 'subway', 'pizza', 'restaurac', 'cafe', 'pub', 'kino', 'cinema',
      'netflix', 'spotify', 'hbo', 'steam', 'bilety kino', 'multikino',
    ],
  },
  { category: 'Coffee', words: ['coffee', 'coffe', 'kawa', 'starbucks', 'costa', 'espresso', 'green caffe'] },
  {
    category: 'Transportation',
    words: [
      'parking', 'bilet', 'jakdojade', 'uber', 'bolt', 'orlen', 'hyperoil', 'shell', 'circle k', 'mpk',
      'pkp', 'flixbus', 'taxi', 'stacja paliw', 'autostrada', 'koleo',
    ],
  },
  { category: 'Medical', words: ['apteka', 'pharmacy', 'dr max', 'medic', 'luxmed', 'lux med', 'dentyst', 'klinika', 'szpital'] },
  {
    category: 'Shopping',
    words: ['allegro', 'aliexpress', 'temu', 'zalando', 'h m', 'reserved', 'zara', 'media expert', 'mediamarkt', 'amazon', 'olx', 'decathlon'],
  },
  { category: 'Home goods', words: ['ikea', 'leroy merlin', 'castorama', 'jysk', 'hurtownia', 'obi'] },
  { category: 'Phone', words: ['orange', 't mobile', 'virgin mobile', 'plus gsm', 'heyah', 'nju'] },
  { category: 'Banking', words: ['monthly subscription fee', 'subscription fee', 'prowizja', 'commission', 'bank fee'] },
  { category: 'Rent', words: ['toya', 'czynsz', 'wynajem', 'rent'] },
  { category: 'Gym', words: ['gym', 'zdrofit', 'calypso', 'fitness', 'multisport', 'benefit systems'] },
  { category: 'Insurance', words: ['ubezpiecz', 'insurance', 'pzu', 'warta', 'allianz'] },
  { category: 'Travel', words: ['booking', 'airbnb', 'ryanair', 'wizzair', 'hotel', 'hostel', 'airlines'] },
]

export const INCOME_RULES = [
  { category: 'Salary', words: ['salary', 'wynagrodzenie', 'pensja', 'wyplata'] },
  { category: 'Other income', words: ['moneyback', 'cashback', 'refund', 'zwrot'] },
]
