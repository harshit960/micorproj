// Turn raw statement descriptions into a merchant name, a kind and a category.
// Pure (no app imports) so it can be unit-tested.

import type { ParsedTx } from "./parse";

export type TxKind = "spend" | "refund" | "payment" | "fee";

/** [category, display name, ...keywords]. First keyword hit wins, so specific entries come first. */
const MERCHANTS: [string, string, ...string[]][] = [
  ["Subscriptions", "AWS", "amazon web services", "aws emea", "aws "],
  ["Subscriptions", "Google Cloud", "google cloud", "google*cloud", "gcp "],
  ["Subscriptions", "DigitalOcean", "digitalocean"],
  ["Subscriptions", "Amazon Prime", "amazon prime", "prime video", "primevideo"],
  ["Subscriptions", "Netflix", "netflix"],
  ["Subscriptions", "Spotify", "spotify"],
  ["Subscriptions", "YouTube Premium", "youtube", "google youtube"],
  ["Subscriptions", "Google One", "google one", "google storage"],
  ["Subscriptions", "Apple", "apple.com/bill", "apple services", "itunes"],
  ["Subscriptions", "Disney+ Hotstar", "hotstar", "disney"],
  ["Subscriptions", "JioCinema", "jiocinema", "jio cinema"],
  ["Subscriptions", "SonyLIV", "sonyliv"],
  ["Subscriptions", "ZEE5", "zee5"],
  ["Subscriptions", "ChatGPT", "openai", "chatgpt"],
  ["Subscriptions", "Claude", "anthropic", "claude.ai"],
  ["Subscriptions", "Microsoft", "microsoft", "msft"],
  ["Subscriptions", "Adobe", "adobe"],
  ["Subscriptions", "Canva", "canva"],
  ["Subscriptions", "Notion", "notion"],
  ["Subscriptions", "LinkedIn", "linkedin"],
  ["Subscriptions", "Audible", "audible"],
  ["Subscriptions", "GitHub", "github"],
  ["Subscriptions", "Vercel", "vercel"],
  ["Groceries", "Swiggy Instamart", "instamart"],
  ["Food", "Swiggy", "swiggy"],
  ["Food", "Zomato", "zomato"],
  ["Food", "EatSure", "eatsure"],
  ["Food", "Domino's", "domino"],
  ["Food", "McDonald's", "mcdonald"],
  ["Food", "KFC", "kfc"],
  ["Food", "Starbucks", "starbucks"],
  ["Food", "Pizza Hut", "pizza hut", "pizzahut"],
  ["Food", "Burger King", "burger king"],
  ["Food", "Subway", "subway"],
  ["Food", "Chaayos", "chaayos"],
  ["Food", "Haldiram's", "haldiram"],
  ["Food", "Blue Tokai", "blue tokai"],
  ["Food", "Third Wave Coffee", "third wave"],
  ["Food", "Barbeque Nation", "barbeque nation"],
  ["Food", "", "restaurant", "cafe", "caffe", "coffee", "bakery", "dhaba", "kitchen", "biryani", "food", "eatery", "bar & grill", " pub ", "brewery"],
  ["Groceries", "Blinkit", "blinkit", "grofers"],
  ["Groceries", "Zepto", "zepto"],
  ["Groceries", "BigBasket", "bigbasket", "big basket", "bbnow"],
  ["Groceries", "DMart", "dmart", "avenue supermarts"],
  ["Groceries", "JioMart", "jiomart"],
  ["Groceries", "Reliance Fresh", "reliance fresh", "reliance smart", "smart bazaar"],
  ["Groceries", "Nature's Basket", "natures basket", "nature's basket"],
  ["Groceries", "Ratnadeep", "ratnadeep"],
  ["Groceries", "More", "more retail", "more supermarket"],
  ["Groceries", "Star Bazaar", "star bazaar"],
  ["Groceries", "Country Delight", "country delight"],
  ["Groceries", "", "supermarket", "grocery", "groceries", "kirana", "provision", "hypermarket"],
  ["Transport", "Uber", "uber"],
  ["Transport", "Ola", "ola cabs", "olacabs", "ani technologies", "ola "],
  ["Transport", "Rapido", "rapido"],
  ["Transport", "Namma Yatri", "namma yatri"],
  ["Transport", "BluSmart", "blusmart"],
  ["Transport", "FASTag", "fastag", "netc"],
  ["Transport", "Fuel", "hpcl", "bpcl", "iocl", "indian oil", "bharat petroleum", "hindustan petroleum", "shell", "petrol", "fuel", "filling station", "service station", "nayara"],
  ["Transport", "Metro", "metro rail", "dmrc", "bmrcl"],
  ["Transport", "", "parking", "toll"],
  ["Travel", "MakeMyTrip", "makemytrip", "mmt"],
  ["Travel", "Goibibo", "goibibo"],
  ["Travel", "Cleartrip", "cleartrip"],
  ["Travel", "Yatra", "yatra"],
  ["Travel", "ixigo", "ixigo"],
  ["Travel", "IRCTC", "irctc"],
  ["Travel", "redBus", "redbus"],
  ["Travel", "IndiGo", "indigo", "interglobe"],
  ["Travel", "Air India", "air india"],
  ["Travel", "Akasa Air", "akasa"],
  ["Travel", "SpiceJet", "spicejet"],
  ["Travel", "Vistara", "vistara"],
  ["Travel", "Airbnb", "airbnb"],
  ["Travel", "OYO", "oyo"],
  ["Travel", "Booking.com", "booking.com"],
  ["Travel", "Agoda", "agoda"],
  ["Travel", "", "hotel", "resort", "airlines", "airways", "travels", "holiday"],
  ["Shopping", "Amazon", "amazon", "amzn"],
  ["Shopping", "Flipkart", "flipkart"],
  ["Shopping", "Myntra", "myntra"],
  ["Shopping", "Ajio", "ajio"],
  ["Shopping", "Nykaa", "nykaa"],
  ["Shopping", "Meesho", "meesho"],
  ["Shopping", "Tata CLiQ", "tata cliq", "tatacliq"],
  ["Shopping", "Croma", "croma"],
  ["Shopping", "Reliance Digital", "reliance digital"],
  ["Shopping", "Decathlon", "decathlon"],
  ["Shopping", "IKEA", "ikea"],
  ["Shopping", "Lenskart", "lenskart"],
  ["Shopping", "FirstCry", "firstcry"],
  ["Shopping", "H&M", "h&m", "h & m", "hennes"],
  ["Shopping", "Zara", "zara"],
  ["Shopping", "Uniqlo", "uniqlo"],
  ["Shopping", "Westside", "westside", "trent"],
  ["Shopping", "Lifestyle", "lifestyle"],
  ["Shopping", "Apple Store", "apple store", "apple india"],
  ["Shopping", "", "store", "retail", "fashion", "mall", "electronics", "footwear", "apparel"],
  ["Bills", "Airtel", "airtel"],
  ["Bills", "Jio", "jio", "reliance jio"],
  ["Bills", "Vi", "vodafone", "vi postpaid", "vodafone idea"],
  ["Bills", "BSNL", "bsnl"],
  ["Bills", "ACT Fibernet", "act fibernet", "atria convergence"],
  ["Bills", "Tata Play", "tata play", "tata sky"],
  ["Bills", "Electricity", "electricity", "bescom", "msedcl", "tneb", "tangedco", "bses", "tata power", "adani electricity", "cesc", "uppcl", " power "],
  ["Bills", "Gas", "indane", "hp gas", "bharat gas", "mahanagar gas", " igl ", " gas "],
  ["Bills", "", "broadband", "postpaid", "recharge", "bill payment", "billdesk", "utility", "water"],
  ["Health", "Apollo", "apollo"],
  ["Health", "PharmEasy", "pharmeasy"],
  ["Health", "Tata 1mg", "1mg"],
  ["Health", "Netmeds", "netmeds"],
  ["Health", "MedPlus", "medplus"],
  ["Health", "Practo", "practo"],
  ["Health", "cult.fit", "cult.fit", "cultfit", "curefit"],
  ["Health", "", "hospital", "clinic", "pharmacy", "chemist", "medical", "diagnostic", "dental", "health", "gym", "fitness"],
  ["Fun", "BookMyShow", "bookmyshow", "bigtree"],
  ["Fun", "PVR INOX", "pvr", "inox"],
  ["Fun", "District", "district"],
  ["Fun", "Steam", "steam"],
  ["Fun", "PlayStation", "playstation", "sony interactive"],
  ["Fun", "", "cinema", "movies", "gaming", "game", "concert", "events", "amusement"],
  ["Education", "Udemy", "udemy"],
  ["Education", "Coursera", "coursera"],
  ["Education", "", "school", "college", "university", "academy", "course", "tuition", "books", "bookstore"],
  ["Insurance", "", "insurance", "lic of india", "policybazaar", "hdfc ergo", "icici lombard", "acko", "go digit", "star health", "max life", "premium"],
  ["Investments", "", "zerodha", "groww", "upstox", "kuvera", "smallcase", "mutual fund", "indian clearing"],
  ["Rent", "", "nobroker", "rent pay", "house rent", "rentpay"],
  ["Gifts", "", "ferns n petals", "fnp", "igp.com", "archies", "gift"],
];

const PAYMENT_RE =
  /\b(payment|paymt|pymt)\b.*\b(received|thank|recd|credited|successful)|thank\s*you|auto\s*debit|autopay|bbps|bill\s*desk\s*payment|\bneft\b|\bimps\b|net\s*banking|netbanking|cheque|payment\s*-?\s*(received|recd)|online\s*payment|card\s*payment|payment\s*towards|repayment/i;
const FEE_RE =
  /\b(annual|joining|renewal|late|overlimit|over\s*limit|processing|cash\s*advance|finance|interest|membership)\b.*\b(fee|fees|charges?)\b|\b(i|c|s)?gst\b|service\s*tax|finance\s*charges?|interest\s*(charged|amount)|markup|surcharge(?!\s*waiv)|forex\s*fee/i;
const EMI_RE = /\bemi\b|principal|interest\s*on\s*emi|loan\s*on\s*card|flexipay|smart\s*emi/i;

export function classify(t: Pick<ParsedTx, "description" | "direction">): TxKind {
  if (t.direction === "credit") return PAYMENT_RE.test(t.description) ? "payment" : "refund";
  if (FEE_RE.test(t.description) && !EMI_RE.test(t.description)) return "fee";
  return "spend";
}

/** Lower-case key used to remember the user's category choice for a merchant. */
export function merchantKey(description: string) {
  return prettifyMerchant(description).toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 2).join(" ");
}

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b([a-z])([a-z']*)/g, (_, a: string, b: string) => (b.length <= 1 && /^(pvt|ltd|llp)$/.test(a + b) ? "" : a.toUpperCase() + b));

/** "PYU*SWIGGY BANGALORE IN" → "Swiggy Bangalore" (generic cleanup when no known merchant matches). */
export function prettifyMerchant(description: string) {
  const s = description
    .replace(/^(pyu|pay|raz|rzp|ccav|paytm|phonepe|gpay|upi|pos|ecom|vps|ips|in|www)\s*[*\-/: ]+/i, "")
    .replace(/https?:\/\/|www\./gi, "")
    .replace(/\.(com|in|co\.in|net|org)\b/gi, "")
    .replace(/\b(pvt|private|ltd|limited|llp|inc|india|ind|in|ind\.?|ireland|singapore|usa|us|gb)\b\.?/gi, " ")
    .replace(/[*#_]+/g, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return titleCase(s).replace(/\s{2,}/g, " ").trim().slice(0, 40) || description.slice(0, 40);
}

export interface Classified {
  kind: TxKind;
  category: string;
  merchant: string;
  known: boolean;
}

/**
 * @param learned merchantKey → category chosen by the user before; wins over built-in rules.
 */
export function categorize(t: Pick<ParsedTx, "description" | "direction">, learned: Map<string, string> = new Map()): Classified {
  const kind = classify(t);
  const low = ` ${t.description.toLowerCase()} `;
  let merchant = "",
    category = "",
    known = false;
  for (const [cat, name, ...keys] of MERCHANTS) {
    if (keys.some((k) => low.includes(k))) {
      category = cat;
      merchant = name;
      known = !!name;
      break;
    }
  }
  if (!merchant) merchant = prettifyMerchant(t.description);
  const key = merchantKey(merchant);
  if (kind === "payment") return { kind, category: "Card payment", merchant: "Card bill payment", known: true };
  if (kind === "refund") return { kind, category: /cashback|reward/i.test(t.description) ? "Refund" : "Refund", merchant, known };
  if (kind === "fee") return { kind, category: "Fees & charges", merchant, known: true };
  if (EMI_RE.test(t.description)) return { kind, category: "EMI", merchant, known: true };
  return { kind, category: learned.get(key) ?? (category || "Other"), merchant, known: known || learned.has(key) };
}

/** Stable 32-bit FNV-1a hash → base36, used for idempotent import ids. */
export function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Deterministic ids so re-importing the same (or an overlapping) statement updates rows
 * instead of duplicating them. Identical rows within one statement get an occurrence suffix.
 */
export function importIds(cardId: string, txs: Pick<ParsedTx, "date" | "amount" | "description" | "direction">[]) {
  const seen = new Map<string, number>();
  return txs.map((t) => {
    const base = `${cardId}|${t.date}|${t.amount.toFixed(2)}|${t.direction}|${t.description.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `cc_${hash(cardId)}_${hash(base + "#" + n)}`;
  });
}
