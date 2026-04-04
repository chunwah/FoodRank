// ============================================================
// FoodRank Backend - Google Places API Integration
// Node.js + Express
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const XHS_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID; // Legacy Google CSE (no longer used)
const SERPAPI_KEY = process.env.SERPAPI_KEY; // SerpAPI key for XHS search via Baidu
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Google Gemini AI

app.use(cors());
app.use(express.json());

// Serve the frontend (public folder)
app.use(express.static(path.join(__dirname, '../public')));

// ============================================================
// SEA HAWKER FOOD TRANSLATION MAP
// Google Places in Malaysia/Singapore uses English/Romanized names
// so we build a bilingual query for better matching
// ============================================================
const FOOD_TRANSLATIONS = {
  // Noodles 面食
  '炒粿条': 'char kway teow char kuey teow',
  '炒果条': 'char kway teow',
  '咖喱面': 'curry mee curry noodle',
  '咖哩面': 'curry mee curry noodle',
  '云吞面': 'wonton noodle wan tan mee',
  '云吞麺': 'wonton noodle',
  '福建面': 'hokkien mee',
  '干捞面': 'dry noodle dry mee',
  '板面': 'pan mee',
  '叻沙': 'laksa',
  '猪脚面': 'pork knuckle noodle',
  '猪肉粉': 'pork noodle',
  '老鼠粉': 'rat tail noodle silver needle noodle',
  '炒米粉': 'fried bee hoon fried vermicelli',
  '汤面': 'soup noodle',
  '牛腩面': 'beef brisket noodle',
  '牛肉面': 'beef noodle',
  '鸭肉面': 'duck noodle',
  '鱼头米粉': 'fish head noodle',
  '沙茶面': 'satay noodle',

  // Rice 饭
  '海南鸡饭': 'hainanese chicken rice',
  '鸡饭': 'chicken rice',
  '叉烧饭': 'char siu rice roast pork rice',
  '烧腊饭': 'roast meat rice',
  '排骨饭': 'pork ribs rice',
  '经济饭': 'economy rice',
  '瓦煲鸡饭': 'claypot chicken rice',
  '炒饭': 'fried rice nasi goreng',
  '咖喱饭': 'curry rice',
  '椰浆饭': 'nasi lemak',

  // Dim Sum 点心
  '点心': 'dim sum yum cha',
  '饮茶': 'yum cha dim sum',
  '虾饺': 'har gao prawn dumpling',
  '烧卖': 'siu mai',
  '叉烧包': 'char siu bao',
  '肠粉': 'cheong fun',
  '萝卜糕': 'turnip cake lor bak gou',

  // Soup & BBQ
  '肉骨茶': 'bak kut teh',
  '猪肚汤': 'pork stomach soup',
  '火锅': 'hotpot steamboat',
  '涮涮锅': 'steamboat hotpot',
  '烧烤': 'bbq barbecue',
  '串烧': 'skewer bbq',
  '沙爹': 'satay',

  // Seafood
  '海鲜': 'seafood',
  '生蚝': 'oyster',
  '螃蟹': 'crab',
  '虾': 'prawn shrimp',
  '龙虾': 'lobster',
  '鱼': 'fish',
  '鱿鱼': 'squid sotong',

  // Snacks & Others
  '煎蕊': 'cendol',
  '糖水': 'dessert tong sui',
  '豆腐花': 'tofu pudding tau fu fa',
  '炸鸡': 'fried chicken',
  '面包': 'bread bakery',
  '咖椰土司': 'kaya toast',
  '猪肠粉': 'pig intestine noodle chee cheong fun',
  '薄饼': 'popiah spring roll',
};

/**
 * Build a smart search query combining Chinese + English name
 * so Google Places can match both Chinese and English-named places
 */
function buildSearchQuery(food) {
  const translation = FOOD_TRANSLATIONS[food.trim()];
  if (translation) {
    return `${food} ${translation}`;
  }
  // If no translation found, still search the raw term — Google may handle it
  return food;
}

// ============================================================
// HELPER: Check API key is set
// ============================================================
function checkApiKey(res) {
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_places_api_key_here') {
    res.status(500).json({
      error: 'API Key 未设置',
      message: '请在 backend/.env 文件里填入你的 GOOGLE_PLACES_API_KEY'
    });
    return false;
  }
  return true;
}

// ============================================================
// ROUTE: Search restaurants
// POST /api/search
// Body: { food: "炒粿条", lat: 3.1478, lng: 101.6953 }
// ============================================================
app.post('/api/search', async (req, res) => {
  if (!checkApiKey(res)) return;

  const { food, lat, lng, radius = 5000, countryCode = 'MY' } = req.body;

  if (!food) {
    return res.status(400).json({ error: '请提供食物名称 (food)' });
  }
  if (!lat || !lng) {
    return res.status(400).json({ error: '请提供位置 (lat, lng)' });
  }

  try {
    // Build bilingual query: e.g. "咖喱面 curry mee curry noodle"
    // This is crucial for Malaysia/Singapore where food stalls use English/Romanized names
    const searchQuery = buildSearchQuery(food);
    console.log(`🔍 搜索: "${searchQuery}" 附近 ${radius}m (原始: "${food}")`);

    // Step 1: Text Search to find restaurants
    const searchResponse = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      {
        textQuery: searchQuery,
        locationBias: {
          circle: {
            center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
            radius: parseFloat(radius)
          }
        },
        maxResultCount: 20,
        // Use English for MY/SG as place names are often in English/Romanized
        languageCode: ['MY','SG','PH','ID','TH','VN'].includes(countryCode) ? 'en' : 'zh-TW',
        // Removed includedType:'restaurant' — too restrictive, misses hawker stalls,
        // kopitiams, food courts. Google Places 'restaurant' type excludes many SEA food places.
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': [
            'places.id',
            'places.displayName',
            'places.formattedAddress',
            'places.rating',
            'places.userRatingCount',
            'places.location',
            'places.priceLevel',
            'places.currentOpeningHours',
            'places.photos'
          ].join(',')
        }
      }
    );

    const places = searchResponse.data.places || [];
    console.log(`✅ 找到 ${places.length} 家餐厅:`);
    places.slice(0, 5).forEach((p, i) =>
      console.log(`   ${i+1}. ${p.displayName?.text} (⭐${p.rating || 'N/A'})`));

    if (places.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    // Step 2: Build results directly from search data (no extra API calls needed)
    // Reviews are loaded lazily on the detail page via GET /api/place/:placeId
    const topPlaces = places.slice(0, 10);

    const results = topPlaces.map((place) => {
      const distance = calculateDistance(
        parseFloat(lat), parseFloat(lng),
        place.location?.latitude, place.location?.longitude
      );

      return {
        id: place.id,
        rank: 0, // assigned after sort
        name: place.displayName?.text || '未知餐厅',
        address: place.formattedAddress || '',
        distance: distance,
        distanceText: formatDistance(distance),

        // Scores
        googleRating: place.rating || null,
        googleReviewCount: place.userRatingCount || 0,

        // Aggregate score (only Google for now)
        aggregateScore: place.rating ? parseFloat(place.rating.toFixed(1)) : null,
        aggregateSources: 1,

        // Opening hours — already included in search FieldMask
        isOpen: place.currentOpeningHours?.openNow ?? null,
        openingHours: place.currentOpeningHours?.weekdayDescriptions || [],

        // Price level — currency depends on detected country
        priceLevel: formatPriceLevel(place.priceLevel, countryCode),
        currencySymbol: (COUNTRY_CURRENCY[countryCode] || DEFAULT_CURRENCY).symbol,

        // Reviews are NOT fetched here — loaded on demand in detail page
        // to keep search fast (avoids 10x extra API calls per search)
        reviews: null,

        // Photo reference (first photo)
        photoRef: place.photos?.[0]?.name || null,

        // Platform availability flags
        platforms: {
          google: true,
          xiaohongshu: false,
          tiktok: false,
          youtube: false,
          klfoodie: false
        }
      };
    });

    // Sort by rating (highest first)
    results.sort((a, b) => (b.googleRating || 0) - (a.googleRating || 0));

    // Re-assign ranks after sorting
    results.forEach((r, i) => r.rank = i + 1);

    res.json({
      results,
      total: results.length,
      query: food,
      location: { lat, lng },
      countryCode,
      currencySymbol: (COUNTRY_CURRENCY[countryCode] || DEFAULT_CURRENCY).symbol,
      searchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Search error:', error.response?.data || error.message);
    res.status(500).json({
      error: '搜索失败',
      message: error.response?.data?.error?.message || error.message
    });
  }
});

// ============================================================
// ROUTE: Get place details + reviews
// GET /api/place/:placeId
// ============================================================
app.get('/api/place/:placeId', async (req, res) => {
  if (!checkApiKey(res)) return;

  const { placeId } = req.params;
  try {
    const detail = await getPlaceDetails(placeId);
    res.json(detail);
  } catch (error) {
    console.error('❌ Place detail error:', error.response?.data || error.message);
    res.status(500).json({ error: '获取详情失败', message: error.message });
  }
});

// ============================================================
// ROUTE: Get place photo
// GET /api/photo/:photoName
// ============================================================
app.get('/api/photo', async (req, res) => {
  if (!checkApiKey(res)) return;

  const { name } = req.query;
  if (!name) return res.status(400).json({ error: '需要提供 name' });

  try {
    const photoUrl = `https://places.googleapis.com/v1/${name}/media?key=${GOOGLE_API_KEY}&maxHeightPx=400&maxWidthPx=400`;
    const response = await axios.get(photoUrl, { responseType: 'arraybuffer' });
    res.set('Content-Type', response.headers['content-type']);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (error) {
    res.status(404).json({ error: '图片获取失败' });
  }
});

// ============================================================
// HELPER: Extract a clean, short restaurant name for XHS search
// Google Places names often include branch/address info that confuses XHS search
// e.g. "Song Fa Bak Kut Teh The Centrepoint 松發肉骨茶 先得坊"
//   → Chinese name: "松發肉骨茶"  (best for XHS)
//   → Short English: "Song Fa Bak Kut Teh"
// ============================================================
function extractXhsSearchName(fullName) {
  // 1. If there are Chinese characters, extract the longest Chinese segment
  //    (skipping short 2-char location words like 分店, 先得坊, etc.)
  const chineseMatches = fullName.match(/[\u4e00-\u9fff·〇]{2,}/g) || [];
  // Filter out common branch/location words
  const locationWords = ['分店', '先得坊', '广场', '购物', '中心', '路店', '号店', '总店', '旗舰'];
  const coreChineseMatches = chineseMatches.filter(m =>
    !locationWords.some(w => m === w) && m.length >= 3
  );
  if (coreChineseMatches.length > 0) {
    // Pick the longest Chinese segment (most likely the restaurant brand name)
    return coreChineseMatches.sort((a, b) => b.length - a.length)[0];
  }

  // 2. No useful Chinese — clean the English name:
  //    Strip anything after a known branch/location indicator
  const stripped = fullName
    .replace(/\s*[\(\（].*[\)\）]/g, '')          // remove (括号内容)
    .replace(/\s*(The\s+\w+|@\s*\w+|\d+\s*\w+\s*(Road|Street|Ave|Jalan|Mall|Plaza|Centre|Center|Point).*)/i, '')
    .trim();

  // If still too long (> 30 chars), take the first 3-4 words only
  const words = stripped.split(/\s+/);
  return words.length > 4 ? words.slice(0, 4).join(' ') : stripped;
}

// ============================================================
// HELPER: Extract clean English name for KLFoodie / English-language platforms
// KLFoodie is an English site — Chinese names won't match anything there.
// e.g. "Song Fa Bak Kut Teh The Centrepoint 松發肉骨茶 先得坊"
//   → "Song Fa Bak Kut Teh"
// e.g. "興旺發肉骨茶RESTORAN HENG ONG HUAT BAK KUT TEH • (MELODIES分行)"
//   → "Heng Ong Huat Bak Kut Teh"
// ============================================================
function extractEnglishName(fullName) {
  // Strip parentheses/brackets content
  let name = fullName
    .replace(/[\(\（][^)\）]*[\)\）]/g, '')
    .replace(/[•·]/g, ' ')
    .trim();

  // Remove Chinese characters entirely — we want the English portion
  const englishPart = name.replace(/[\u4e00-\u9fff\u3400-\u4dbf]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (!englishPart) {
    // All Chinese, no English — use the FOOD_TRANSLATIONS to get English equivalent
    return null; // caller handles this
  }

  // Strip address/branch suffixes:
  // "Song Fa Bak Kut Teh The Centrepoint" → "Song Fa Bak Kut Teh"
  const cleaned = englishPart
    .replace(/\s+(The\s+\w+point|\d+\s+\w+|@\s*\w+)/i, '')   // The Centrepoint, 327 Hougang
    .replace(/\s+(Jalan|Jln|Lorong|No\.|No\s+\d|Level|Lot\s)\S.*/i, '')  // Jalan xxx, No. xx
    .replace(/\s+(Mall|Plaza|Centre|Center|Square|Tower|Block)\s+.*/i, '') // Mall/Plaza/etc
    .replace(/\bRESTORAN\b/gi, '')   // RESTORAN prefix common in MY
    .replace(/\s+/g, ' ')
    .trim();

  // If still long (>5 words), drop trailing words that look like locations
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > 5) {
    // Keep up to 5 words — the brand name is almost always first
    return words.slice(0, 5).join(' ');
  }
  return cleaned;
}

// ============================================================
// ROUTE: Search Instagram posts for a restaurant
// GET /api/instagram?restaurant=Song Fa Bak Kut Teh&food=肉骨茶
//
// Strategy:
//   1. Extract clean English name (Instagram is English-dominant)
//   2. Google site:instagram.com — Google indexes most public IG posts
//   3. Fallback: food type + city
// ============================================================
app.get('/api/instagram', async (req, res) => {
  const { restaurant, food = '', city = '' } = req.query;
  if (!restaurant) return res.status(400).json({ error: '需要提供 restaurant 名称' });

  if (!SERPAPI_KEY || SERPAPI_KEY === 'your_serpapi_key_here') {
    return res.json({ posts: [], total: 0, message: 'SERPAPI_KEY 未设置' });
  }

  // Instagram is mostly English — use English name
  const searchName = extractEnglishName(restaurant) || extractXhsSearchName(restaurant) || restaurant;
  console.log(`📸 Instagram 搜索: "${restaurant}" → "${searchName}"`);

  try {
    // Tier 1: exact restaurant name on Instagram
    let items = await searchInstagram(`"${searchName}"`);

    // Tier 2: without quotes — broader
    if (items.length < 3) {
      const wider = await searchInstagram(searchName);
      // Merge, deduplicate by link
      const seen = new Set(items.map(i => i.link));
      wider.forEach(i => { if (!seen.has(i.link)) { items.push(i); seen.add(i.link); } });
    }

    // Tier 3: food type + city fallback
    if (items.length < 3 && food && city) {
      const englishFood = buildSearchQuery(food);
      console.log(`   结果不足，尝试 food+city: "${englishFood} ${city}"`);
      const areaItems = await searchInstagram(`${englishFood} ${city}`);
      areaItems.forEach(i => i.matchType = 'area');
      const seen = new Set(items.map(i => i.link));
      areaItems.forEach(i => { if (!seen.has(i.link)) items.push(i); });
    }

    items = items.slice(0, 5);
    console.log(`✅ Instagram 找到 ${items.length} 条帖子`);

    // Sentiment from caption/snippet
    const scored = items.filter(i => i.sentiment !== null);
    const avgScore = scored.length > 0
      ? parseFloat((scored.reduce((s, i) => s + i.sentiment, 0) / scored.length).toFixed(1))
      : null;

    res.json({ posts: items, avgScore, total: items.length });

  } catch (error) {
    console.error('❌ Instagram error:', error.response?.data || error.message);
    res.json({ posts: [], avgScore: null, total: 0, error: error.message });
  }
});

/**
 * Search Instagram posts via SerpAPI (Google site:instagram.com)
 */
async function searchInstagram(query) {
  const response = await axios.get('https://serpapi.com/search', {
    params: {
      engine:  'google',
      q:       `site:instagram.com ${query}`,
      api_key: SERPAPI_KEY,
      num:     10,
      gl:      'my',
      hl:      'en'
    },
    timeout: 10000
  });

  const items = response.data.organic_results || [];
  console.log(`   site:instagram.com "${query}" → ${items.length} 条`);

  return items
    .filter(item => (item.link || '').includes('instagram.com'))
    .map(item => {
      // Extract @username from URL: instagram.com/p/xxx or instagram.com/username/
      const usernameMatch = (item.link || '').match(/instagram\.com\/([^/p][^/]*)\//);
      const username = usernameMatch ? '@' + usernameMatch[1] : '';

      const thumbnail = item.thumbnail || null;
      const text = (item.title || '') + ' ' + (item.snippet || '');
      const sentiment = analyzeSentiment(text);

      return {
        title:     item.title   || '',
        snippet:   item.snippet || '',
        link:      item.link    || '',
        thumbnail,
        username,
        sentiment,
        matchType: 'exact'
      };
    });
}

// ============================================================
// HELPER: Sentiment analysis from Chinese review text
// Returns a score 1.0–5.0 based on positive/negative keywords
// ============================================================
function analyzeSentiment(text) {
  if (!text) return 3.5;

  const positive = [
    '好吃', '必吃', '推荐', '超好', '喜欢', '棒', '赞', '美味', '值得',
    '不错', '好评', '满意', '惊艳', '必试', '强推', '太好吃', '超级好',
    '一定要', '真的好', '无敌', '好评如潮', '再来', '会再来', 'nice', 'good',
    'amazing', 'delicious', 'must try', 'best', 'love', '爱了', '绝了',
    '超赞', '好吃到', '值得一试', '排队也值'
  ];
  const negative = [
    '难吃', '一般', '失望', '不好', '差', '太贵', '不值', '后悔',
    '一般般', '不推', '踩雷', '避雷', '太咸', '太甜', '太油', '变质',
    '不干净', '服务差', '等太久', 'bad', 'terrible', 'disappointing', 'overrated'
  ];

  let score = 3.5;
  positive.forEach(w => { if (text.toLowerCase().includes(w.toLowerCase())) score += 0.25; });
  negative.forEach(w => { if (text.toLowerCase().includes(w.toLowerCase())) score -= 0.35; });

  return parseFloat(Math.max(1.0, Math.min(5.0, score)).toFixed(1));
}

// ============================================================
// ROUTE: KLFoodie reviews for a restaurant
// GET /api/klfoodie?restaurant=松發肉骨茶&food=肉骨茶
//
// KLFoodie (klfoodie.com) is Malaysia's top local food review site.
// No public API, so we use SerpAPI to search Google for site:klfoodie.com pages.
// KLFoodie pages often contain structured ratings in Google rich snippets.
// ============================================================
app.get('/api/klfoodie', async (req, res) => {
  const { restaurant, food = '' } = req.query;
  if (!restaurant) return res.status(400).json({ error: '需要提供 restaurant 名称' });

  if (!SERPAPI_KEY || SERPAPI_KEY === 'your_serpapi_key_here') {
    return res.json({ posts: [], total: 0, message: 'SERPAPI_KEY 未设置' });
  }

  // KLFoodie is English — extract English name, fall back to full name if none
  const englishName = extractEnglishName(restaurant) || restaurant;
  // For food fallback, use English translation (e.g. 咖喱面 → "curry mee")
  const englishFood = buildSearchQuery(food).split(' ').slice(1).join(' ') || food;
  console.log(`🍽️  KLFoodie 搜索 (英文): "${restaurant}" → "${englishName}"`);

  try {
    // Tier 1: exact English restaurant name
    let items = await searchKLFoodie(`"${englishName}"`);

    // Tier 2: without quotes (broader)
    if (items.length === 0) {
      console.log(`   无精确结果，尝试宽搜 "${englishName}"...`);
      items = await searchKLFoodie(englishName);
    }

    // Tier 3: English food type as last resort
    if (items.length === 0 && englishFood) {
      console.log(`   尝试食物类型搜索: "${englishFood}"...`);
      items = await searchKLFoodie(englishFood);
      items.forEach(i => i.matchType = 'food');
    }

    // Extract rating from Google rich snippets (KLFoodie uses schema.org)
    const scored = items.filter(i => i.rating);
    const avgRating = scored.length > 0
      ? parseFloat((scored.reduce((s, i) => s + i.rating, 0) / scored.length).toFixed(1))
      : null;

    items = items.slice(0, 3);
    console.log(`✅ KLFoodie 找到 ${items.length} 条结果，平均评分: ${avgRating || 'N/A'}`);
    res.json({ posts: items, avgRating, total: items.length });

  } catch (err) {
    console.error('❌ KLFoodie error:', err.message);
    res.json({ posts: [], avgRating: null, total: 0, error: err.message });
  }
});

/**
 * Search klfoodie.com via SerpAPI (Google site: filter)
 */
async function searchKLFoodie(query) {
  const response = await axios.get('https://serpapi.com/search', {
    params: {
      engine:  'google',
      q:       `site:klfoodie.com ${query}`,
      api_key: SERPAPI_KEY,
      num:     5,
      gl:      'my',   // Malaysia
      hl:      'en'
    },
    timeout: 10000
  });

  const results = response.data.organic_results || [];
  console.log(`   site:klfoodie.com "${query}" → ${results.length} 条`);

  return results
    .filter(r => (r.link || '').includes('klfoodie.com'))
    .map(r => {
      // Try to extract rating from rich snippet (KLFoodie has schema.org markup)
      const ratingRaw = r.rich_snippet?.top?.detected_extensions?.rating
                     || r.rich_snippet?.bottom?.detected_extensions?.rating
                     || null;
      const reviewCount = r.rich_snippet?.top?.detected_extensions?.reviews
                       || r.rich_snippet?.bottom?.detected_extensions?.reviews
                       || null;

      return {
        title:       r.title   || '',
        snippet:     r.snippet || '',
        link:        r.link    || '',
        rating:      ratingRaw ? parseFloat(ratingRaw) : null,
        reviewCount: reviewCount ? parseInt(reviewCount) : null,
        matchType:   'exact'
      };
    });
}

// ============================================================
// ROUTE: TikTok videos for a restaurant
// GET /api/tiktok?restaurant=松發肉骨茶&food=肉骨茶&city=Singapore
//
// Strategy:
//   1. Clean name → "松發肉骨茶" (reuses extractXhsSearchName)
//   2. Search SerpAPI Google: site:tiktok.com "松發肉骨茶"
//   3. Fallback: site:tiktok.com food+city (area-level)
// ============================================================
app.get('/api/tiktok', async (req, res) => {
  const { restaurant, food = '', city = '' } = req.query;
  if (!restaurant) return res.status(400).json({ error: '需要提供 restaurant 名称' });

  if (!SERPAPI_KEY || SERPAPI_KEY === 'your_serpapi_key_here') {
    return res.json({ videos: [], total: 0, message: 'SERPAPI_KEY 未设置' });
  }

  const searchName = extractXhsSearchName(restaurant);
  console.log(`🎵 TikTok 搜索: "${restaurant}" → 简化为 "${searchName}"`);

  try {
    // Tier 1: exact restaurant name on TikTok
    let videos = (await searchTikTok(`"${searchName}" ${city}`.trim())).slice(0, 3);

    // Tier 2: if few results, try food type + city
    if (videos.length < 3 && food && city) {
      console.log(`   结果不足，尝试 food+city: "${food} ${city}"`);
      const areaVideos = await searchTikTok(`${food} ${city}`);
      // Mark area results so UI can show a badge
      areaVideos.forEach(v => v.matchType = 'area');
      videos = [...videos, ...areaVideos].slice(0, 3);
    }

    console.log(`✅ TikTok 最终找到 ${videos.length} 个视频`);
    res.json({ videos, total: videos.length });

  } catch (err) {
    console.error('❌ TikTok error:', err.message);
    res.json({ videos: [], total: 0, error: err.message });
  }
});

/**
 * Search TikTok videos via SerpAPI (Google site:tiktok.com)
 * Returns array of { title, link, thumbnail, creator, views, matchType }
 */
async function searchTikTok(query) {
  const response = await axios.get('https://serpapi.com/search', {
    params: {
      engine:  'google',
      q:       `site:tiktok.com ${query}`,
      api_key: SERPAPI_KEY,
      num:     10,
      hl:      'zh-cn',
      gl:      'my'   // Malaysia — closer to SEA food content
    },
    timeout: 10000
  });

  const items = response.data.organic_results || [];
  console.log(`   Google site:tiktok.com "${query}" → ${items.length} 条`);

  return items
    .filter(item => (item.link || '').includes('tiktok.com'))
    .slice(0, 6)
    .map(item => {
      // Extract creator handle from TikTok URL: tiktok.com/@creator/video/123
      const creatorMatch = (item.link || '').match(/@([^/]+)/);
      const creator = creatorMatch ? '@' + creatorMatch[1] : '';

      // Thumbnail from rich snippet or inline image
      const thumbnail = item.thumbnail
        || item.rich_snippet?.top?.extensions?.[0]
        || null;

      // View count sometimes appears in rich snippet extensions
      const rawViews = item.rich_snippet?.top?.detected_extensions?.views
        || item.rich_snippet?.top?.detected_extensions?.likes
        || null;

      return {
        title:     item.title   || '',
        link:      item.link    || '',
        snippet:   item.snippet || '',
        thumbnail,
        creator,
        views:     rawViews ? parseInt(rawViews) : null,
        matchType: 'exact'
      };
    });
}

// ============================================================
// ROUTE: YouTube videos for a restaurant
// GET /api/youtube?restaurant=阿发炒粿条&food=炒粿条&city=Kuala Lumpur&regionCode=MY
//
// Search strategy (3 tiers):
//   1. Exact restaurant name  → matchType: "exact"
//   2. Restaurant name + city → matchType: "name"
//   3. Food type + city       → matchType: "area"  (labelled differently in UI)
// ============================================================
app.get('/api/youtube', async (req, res) => {
  if (!checkApiKey(res)) return;

  const { restaurant, food = '', city = '', regionCode = 'MY' } = req.query;
  if (!restaurant) return res.status(400).json({ error: '需要提供 restaurant 名称' });

  try {
    let videos = [];
    let matchType = 'exact';

    // Tier 1: exact restaurant name (quoted)
    videos = await searchYouTube(`"${restaurant}"`, regionCode);

    // Tier 2: restaurant name + city (unquoted, broader)
    if (videos.length < 3) {
      matchType = 'name';
      const tier2 = await searchYouTube(`${restaurant} ${city}`.trim(), regionCode);
      // Merge, avoid duplicates
      const ids = new Set(videos.map(v => v.videoId));
      tier2.forEach(v => { if (!ids.has(v.videoId)) { videos.push(v); ids.add(v.videoId); } });
    }

    // Tier 3: food type + city (area-level fallback)
    if (videos.length < 3 && food) {
      matchType = videos.length === 0 ? 'area' : matchType;
      const tier3 = await searchYouTube(`${food} ${city}`.trim(), regionCode);
      const ids = new Set(videos.map(v => v.videoId));
      tier3.forEach(v => {
        if (!ids.has(v.videoId)) {
          v.matchType = 'area'; // mark individually as area-level
          videos.push(v);
          ids.add(v.videoId);
        }
      });
    }

    // Tag non-area videos with correct matchType
    videos = videos.map(v => ({ ...v, matchType: v.matchType || matchType }));

    console.log(`📺 YouTube: "${restaurant}" → ${videos.length} 个视频 (strategy: ${matchType})`);
    res.json({ videos: videos.slice(0, 10), total: videos.length, matchType });

  } catch (error) {
    console.error('❌ YouTube error:', error.response?.data || error.message);
    res.json({ videos: [], total: 0, error: error.message });
  }
});

// ============================================================
// HELPER: Call YouTube Data API v3 search
// ============================================================
async function searchYouTube(query, regionCode = 'MY') {
  const langMap = { MY: 'zh-TW', SG: 'zh-TW', TH: 'th', ID: 'id', PH: 'tl', VN: 'vi' };
  const lang = langMap[regionCode] || 'zh-TW';

  const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
    params: {
      key: GOOGLE_API_KEY,
      q: query,
      part: 'snippet',
      type: 'video',
      maxResults: 3,
      regionCode,
      // No category or language filter — food videos span all categories
      // and KL/SEA content is a mix of Chinese, English, Malay
      order: 'relevance'
    }
  });

  const items = searchRes.data.items || [];
  if (items.length === 0) return [];

  // Fetch view counts + durations in one batch call
  const videoIds = items.map(i => i.id.videoId).join(',');
  const statsRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
    params: {
      key: GOOGLE_API_KEY,
      id: videoIds,
      part: 'statistics,contentDetails'
    }
  });

  const statsMap = {};
  (statsRes.data.items || []).forEach(v => { statsMap[v.id] = v; });

  return items.map(item => {
    const vid    = item.id.videoId;
    const snip   = item.snippet;
    const stats  = statsMap[vid]?.statistics || {};
    const detail = statsMap[vid]?.contentDetails || {};

    return {
      videoId:      vid,
      title:        snip.title,
      channelName:  snip.channelTitle,
      publishedAt:  snip.publishedAt,
      thumbnail:    snip.thumbnails?.medium?.url || snip.thumbnails?.default?.url || '',
      youtubeUrl:   `https://www.youtube.com/watch?v=${vid}`,
      viewCount:    parseInt(stats.viewCount || 0),
      likeCount:    parseInt(stats.likeCount || 0),
      duration:     parseDuration(detail.duration || ''),
    };
  });
}

// ============================================================
// HELPER: Parse ISO 8601 duration → "4:32"
// ============================================================
function parseDuration(iso) {
  if (!iso) return '';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '';
  const h = parseInt(m[1] || 0);
  const min = parseInt(m[2] || 0);
  const sec = parseInt(m[3] || 0);
  if (h > 0) return `${h}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${min}:${String(sec).padStart(2,'0')}`;
}

// ============================================================
// ROUTE: Health check
// ============================================================
// ROUTE: AI Food Recommendation via Gemini
// POST /api/ai-recommend
// Body: { meal, weather, mood, base, flavor, budget, freeText, countryCode }
// ============================================================
app.post('/api/ai-recommend', async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(400).json({ error: 'GEMINI_API_KEY 未设置' });
  }

  const { meal, weather, mood, base, flavor, budget, freeText, countryCode } = req.body;
  const country = countryCode === 'SG' ? 'Singapore' : 'Malaysia';
  const weatherDesc = weather?.isRainy ? '下雨天' : weather?.isSunny ? '晴天' : '阴天';
  const tempDesc = weather?.temp ? `，气温 ${weather.temp}°C` : '';

  const prompt = `你是一个专业的${country}美食推荐 AI，非常了解当地的美食文化。
  根据以下信息，推荐一道最适合的本地食物：

  - 时间段：${meal || '未知'}
  - 天气：${weatherDesc}${tempDesc}
  - 心情：${mood || '未知'}
  - 主食偏好：${base || '随便'}
  - 口味偏好：${flavor || '随便'}
  - 预算：${budget || '随便'}
  ${freeText ? `- 用户补充：${freeText}` : ''}

  要求：
  1. 只推荐一道菜，必须是${country}常见的本地食物。
  2. 推荐理由要温暖、有趣，联系到天气和心情，2-3句话。
  直接输出结果，不要重复我的问题，不要任何多余的寒暄。`;

console.log("给Gemini的prompt:", prompt);
const callGemini = async (prompt) => {
  if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
    throw new Error('请求失败：必须提供有效的文本 prompt');
  }

  try {
    const response = await axios.post(
      // 确认你使用的是稳定版模型
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { 
          temperature: 0.8, 
          maxOutputTokens: 800, // 确保上限足够高
          responseMimeType: "application/json",
          // 强制规范 JSON 结构，防止模型废话
          responseSchema: {
            type: "object",
            properties: {
              food: { type: "string" },
              emoji: { type: "string" },
              reason: { type: "string" }
            },
            required: ["food", "emoji", "reason"]
          }
        },
        // 临时放宽安全策略，排除误杀的可能性
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      }
    );

    const candidate = response.data.candidates?.[0];
    const rawText = candidate?.content?.parts?.[0]?.text || '';
    
    // 💡 核心侦察兵：打印 API 到底是因为什么停止生成的
    console.log("【停止原因 finishReason】:", candidate?.finishReason);
    console.log("【Gemini 原始返回文本】:", rawText);

    try {
      return JSON.parse(rawText);
    } catch (parseError) {
      console.error("❌ JSON 解析彻底失败！");
      throw new Error("模型返回的 JSON 格式不规范，请重试");
    }

  } catch (error) {
    if (error.response) {
      console.error("API 报错详情:", JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
};

  try {
    let rec;
    try {
      rec = await callGemini(prompt);
    } catch (err) {
      if (err.response?.status === 429) {
        // Rate limited — wait 10s and retry once
        console.log('⚠️ Gemini rate limited, retrying in 10s...');
        await new Promise(r => setTimeout(r, 10000));
        rec = await callGemini(prompt);
      } else {
        throw err;
      }
    }
    res.json({ success: true, food: rec.food, emoji: rec.emoji, reason: rec.reason });
  } catch (err) {
    const status = err.response?.status;
    const detail = err.response?.data?.error?.message || err.message;
    console.error(`❌ Gemini error: ${status}`, detail);
    // Return 503 so frontend knows to fallback gracefully
    res.status(503).json({ error: 'AI 推荐暂时不可用', fallback: true, detail });
  }
});

// GET /api/health
// ============================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    googlePlacesKey: !!(GOOGLE_API_KEY && GOOGLE_API_KEY !== 'your_google_places_api_key_here'),
    xiaohongshuCse:  !!(XHS_SEARCH_ENGINE_ID && XHS_SEARCH_ENGINE_ID !== 'your_cse_id_here'),
    youtubeApi:      true, // uses same Google API key
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// HELPER: Get Place Details from Google Places API (New)
// ============================================================
async function getPlaceDetails(placeId) {
  const response = await axios.get(
    `https://places.googleapis.com/v1/places/${placeId}`,
    {
      headers: {
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': [
          'id',
          'displayName',
          'rating',
          'userRatingCount',
          'reviews',
          'currentOpeningHours',
          'priceLevel',
          'formattedAddress',
          'internationalPhoneNumber',
          'websiteUri'
        ].join(','),
        'Accept-Language': 'zh-TW'
      }
    }
  );
  return response.data;
}

// ============================================================
// HELPER: Calculate distance between two coordinates (km)
// ============================================================
function calculateDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return null;
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function formatDistance(meters) {
  if (!meters) return '';
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

// ============================================================
// HELPER: Currency & price ranges per country (Southeast Asia)
// ============================================================
const COUNTRY_CURRENCY = {
  MY: { symbol: 'RM',  cheap: '5–12',      mid: '12–30',     exp: '30–80',      vexp: '80+'    },
  SG: { symbol: 'S$',  cheap: '5–10',      mid: '10–30',     exp: '30–80',      vexp: '80+'    },
  TH: { symbol: '฿',   cheap: '50–150',    mid: '150–400',   exp: '400–1000',   vexp: '1000+'  },
  ID: { symbol: 'Rp',  cheap: '15k–50k',   mid: '50k–150k',  exp: '150k–500k',  vexp: '500k+'  },
  PH: { symbol: '₱',   cheap: '80–200',    mid: '200–600',   exp: '600–1500',   vexp: '1500+'  },
  VN: { symbol: '₫',   cheap: '30k–80k',   mid: '80k–200k',  exp: '200k–500k',  vexp: '500k+'  },
  MM: { symbol: 'K',   cheap: '2k–5k',     mid: '5k–15k',    exp: '15k–50k',    vexp: '50k+'   },
  KH: { symbol: '$',   cheap: '2–5',       mid: '5–15',      exp: '15–40',      vexp: '40+'    },
  BN: { symbol: 'B$',  cheap: '3–8',       mid: '8–20',      exp: '20–50',      vexp: '50+'    },
  LA: { symbol: '₭',   cheap: '15k–40k',   mid: '40k–120k',  exp: '120k–300k',  vexp: '300k+'  },
};
const DEFAULT_CURRENCY = COUNTRY_CURRENCY['MY']; // fallback

function formatPriceLevel(level, countryCode) {
  const c = COUNTRY_CURRENCY[countryCode] || DEFAULT_CURRENCY;
  const map = {
    'PRICE_LEVEL_FREE':           'Free',
    'PRICE_LEVEL_INEXPENSIVE':    `${c.symbol} ${c.cheap}`,
    'PRICE_LEVEL_MODERATE':       `${c.symbol} ${c.mid}`,
    'PRICE_LEVEL_EXPENSIVE':      `${c.symbol} ${c.exp}`,
    'PRICE_LEVEL_VERY_EXPENSIVE': `${c.symbol} ${c.vexp}`,
  };
  return map[level] || '';
}

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, () => {
  console.log('');
  console.log('🍜 FoodRank Server 启动成功！');
  console.log(`📡 本地地址: http://localhost:${PORT}`);
  console.log(`🔑 Google Places Key: ${GOOGLE_API_KEY ? '✅ 已设置' : '❌ 未设置 (请配置 .env 文件)'}`);
  console.log(`📕 小红书 SerpAPI Key: ${SERPAPI_KEY && SERPAPI_KEY !== 'your_serpapi_key_here' ? '✅ 已设置' : '⚠️  未设置 (注册 serpapi.com 获取免费 Key)'}`);
  console.log('');
  console.log('可用 API 路由:');
  console.log('  POST /api/search    - 搜索附近餐厅 (Google Places)');
  console.log('  GET  /api/instagram - 搜索 Instagram 帖子 (SerpAPI/Google)');
  console.log('  GET  /api/tiktok    - 搜索 TikTok 视频 (SerpAPI/Google)');
  console.log('  GET  /api/klfoodie  - 搜索 KLFoodie 评论 (SerpAPI/Google)');
  console.log('  GET  /api/youtube   - 搜索 YouTube 视频');
  console.log('  GET  /api/place/:id - 获取餐厅详情');
  console.log('  GET  /api/health    - 健康检查');
  console.log('');
});