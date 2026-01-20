import crypto from "crypto";
import type { BotSettings } from "@shared/schema";
import { storage } from "../storage";

export interface MarketPrice {
  symbol: string;
  price: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
}

export interface OrderResult {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  status: string;
}

export interface AccountInfo {
  totalBalance: number;
  availableBalance: number;
  positions: Position[];
}

export interface Position {
  symbol: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  unrealizedPnl: number;
  leverage: number;
}

// دقة الكمية لكل عملة (عدد الأرقام بعد الفاصلة)
const SYMBOL_PRECISION: Record<string, { quantity: number; price: number }> = {
  'BTCUSDT': { quantity: 3, price: 1 },
  'ETHUSDT': { quantity: 3, price: 2 },
  'BNBUSDT': { quantity: 2, price: 2 },
  'XRPUSDT': { quantity: 1, price: 4 },
  'SOLUSDT': { quantity: 0, price: 2 },
  'ADAUSDT': { quantity: 0, price: 4 },
  'DOGEUSDT': { quantity: 0, price: 5 },
  'DOTUSDT': { quantity: 1, price: 3 },
  'AVAXUSDT': { quantity: 1, price: 2 },
  'BCHUSDT': { quantity: 3, price: 2 },
  'LTCUSDT': { quantity: 3, price: 2 },
  'LINKUSDT': { quantity: 2, price: 3 },
  'MATICUSDT': { quantity: 0, price: 4 },
  'IMXUSDT': { quantity: 0, price: 4 },
};

export class BinanceService {
  private apiKey: string;
  private apiSecret: string;
  private isTestnet: boolean;
  private baseUrl: string;
  private customApiUrl: string | null;

  // Cache for hedging mode detection (avoid repeated API calls)
  private cachedHedgingMode: boolean | null = null;
  private hedgingModeCacheTime: number = 0;
  private readonly HEDGING_CACHE_TTL = 60000; // 60 seconds cache

  constructor(settings?: BotSettings) {
    this.apiKey = settings?.binanceApiKey || '';
    this.apiSecret = settings?.binanceApiSecret || '';
    this.isTestnet = settings?.isTestnet ?? true;
    this.customApiUrl = settings?.customApiUrl || null;
    this.baseUrl = this.getBaseUrl();
  }

  private getBaseUrl(): string {
    // إذا كان هناك عنوان مخصص، استخدمه
    if (this.customApiUrl && this.customApiUrl.trim()) {
      return this.customApiUrl.trim().replace(/\/$/, ''); // إزالة / من النهاية
    }
    // وإلا استخدم العنوان الافتراضي
    return this.isTestnet
      ? 'https://testnet.binancefuture.com'
      : 'https://fapi.binance.com';
  }

  private getSymbolPrecision(symbol: string): { quantity: number; price: number } {
    const formatted = symbol.replace('/', '').toUpperCase();
    return SYMBOL_PRECISION[formatted] || { quantity: 3, price: 2 };
  }

  formatQuantity(symbol: string, quantity: number): string {
    const precision = this.getSymbolPrecision(symbol);
    const formatted = quantity.toFixed(precision.quantity);
    // إزالة الأصفار الزائدة
    return parseFloat(formatted).toString();
  }

  formatPrice(symbol: string, price: number): string {
    const precision = this.getSymbolPrecision(symbol);
    return price.toFixed(precision.price);
  }

  updateSettings(settings: BotSettings) {
    this.apiKey = settings.binanceApiKey || '';
    this.apiSecret = settings.binanceApiSecret || '';
    this.isTestnet = settings.isTestnet ?? true;
    this.customApiUrl = settings.customApiUrl || null;
    this.baseUrl = this.getBaseUrl();
  }

  private signRequest(params: Record<string, string>): string {
    const queryString = new URLSearchParams(params).toString();
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
    return `${queryString}&signature=${signature}`;
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this.apiKey || !this.apiSecret) {
        return false;
      }

      const timestamp = Date.now().toString();
      const params = { timestamp };
      const signedQuery = this.signRequest(params);

      const response = await fetch(`${this.baseUrl}/fapi/v2/account?${signedQuery}`, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  // Auto-detect if Binance account has hedging (dual-side) mode enabled
  // Uses caching to avoid repeated API calls
  async getPositionMode(): Promise<boolean> {
    try {
      // Check cache first
      const now = Date.now();
      if (this.cachedHedgingMode !== null && (now - this.hedgingModeCacheTime) < this.HEDGING_CACHE_TTL) {
        return this.cachedHedgingMode;
      }

      if (!this.apiKey || !this.apiSecret) {
        console.log('No API keys, using cached or default hedging mode');
        return this.cachedHedgingMode ?? false; // Default to one-way if no cache
      }

      const timestamp = Date.now().toString();
      const params = { timestamp };
      const signedQuery = this.signRequest(params);

      const response = await fetch(`${this.baseUrl}/fapi/v1/positionSide/dual?${signedQuery}`, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      if (!response.ok) {
        console.error('Failed to get position mode:', await response.text());
        // On API failure, return cached value if available, otherwise default to false (one-way)
        // This is safer than defaulting to hedging which could cause wrong positionSide
        return this.cachedHedgingMode ?? false;
      }

      const data = await response.json();
      const isHedgingMode = data.dualSidePosition === true;

      // Cache the result
      this.cachedHedgingMode = isHedgingMode;
      this.hedgingModeCacheTime = now;

      console.log(`Binance position mode: ${isHedgingMode ? 'HEDGING (dual-side)' : 'ONE-WAY'} (cached)`);
      return isHedgingMode;
    } catch (error) {
      console.error('Failed to get position mode:', error);
      // On error, return cached value if available, otherwise default to false (one-way)
      return this.cachedHedgingMode ?? false;
    }
  }

  // Clear hedging mode cache (call when settings change)
  clearHedgingModeCache(): void {
    this.cachedHedgingMode = null;
    this.hedgingModeCacheTime = 0;
  }

  async getMarketPrice(symbol: string): Promise<MarketPrice | null> {
    try {
      const formattedSymbol = symbol.replace('/', '');

      const tickerResponse = await fetch(
        `${this.baseUrl}/fapi/v1/ticker/24hr?symbol=${formattedSymbol}`
      );

      if (!tickerResponse.ok) {
        return null;
      }

      const ticker = await tickerResponse.json();

      return {
        symbol,
        price: parseFloat(ticker.lastPrice),
        high24h: parseFloat(ticker.highPrice),
        low24h: parseFloat(ticker.lowPrice),
        volume24h: parseFloat(ticker.volume),
        priceChange24h: parseFloat(ticker.priceChange),
        priceChangePercent24h: parseFloat(ticker.priceChangePercent),
      };
    } catch (error) {
      console.error('Failed to get market price:', error);
      return null;
    }
  }

  async getKlines(symbol: string, interval: string = '1h', limit: number = 200): Promise<number[]> {
    try {
      const formattedSymbol = symbol.replace('/', '');

      const response = await fetch(
        `${this.baseUrl}/fapi/v1/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`
      );

      if (!response.ok) {
        return [];
      }

      const klines = await response.json();
      return klines.map((k: any[]) => parseFloat(k[4]));
    } catch (error) {
      console.error('Failed to get klines:', error);
      return [];
    }
  }

  async getKlinesOHLCV(symbol: string, interval: string = '1h', limit: number = 100): Promise<{
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: number;
  }[]> {
    try {
      const formattedSymbol = symbol.replace('/', '');

      const response = await fetch(
        `${this.baseUrl}/fapi/v1/klines?symbol=${formattedSymbol}&interval=${interval}&limit=${limit}`
      );

      if (!response.ok) {
        return [];
      }

      const klines = await response.json();
      return klines.map((k: any[]) => ({
        timestamp: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));
    } catch (error) {
      console.error('Failed to get OHLCV klines:', error);
      return [];
    }
  }

  async getAccountInfo(): Promise<AccountInfo | null> {
    try {
      if (!this.apiKey || !this.apiSecret) {
        console.log('No API credentials configured');
        return null;
      }

      const timestamp = Date.now().toString();
      const params = { timestamp };
      const signedQuery = this.signRequest(params);

      console.log(`Fetching account from: ${this.baseUrl}/fapi/v2/account`);

      const response = await fetch(`${this.baseUrl}/fapi/v2/account?${signedQuery}`, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Binance API error (${response.status}): ${errorText}`);
        return null;
      }

      const account = await response.json();

      return {
        totalBalance: parseFloat(account.totalWalletBalance) || 0,
        availableBalance: parseFloat(account.availableBalance) || 0,
        positions: (account.positions || [])
          .filter((p: any) => parseFloat(p.positionAmt) !== 0)
          .map((p: any) => ({
            symbol: p.symbol,
            side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
            entryPrice: parseFloat(p.entryPrice),
            quantity: Math.abs(parseFloat(p.positionAmt)),
            unrealizedPnl: parseFloat(p.unrealizedProfit),
            leverage: parseInt(p.leverage),
          })),
      };
    } catch (error) {
      console.error('Failed to get account info:', error);
      return null;
    }
  }

  async setLeverage(symbol: string, leverage: number): Promise<boolean> {
    try {
      if (!this.apiKey || !this.apiSecret) {
        return false;
      }

      const formattedSymbol = symbol.replace('/', '');
      const params = {
        symbol: formattedSymbol,
        leverage: leverage.toString(),
        timestamp: Date.now().toString(),
      };

      const signedQuery = this.signRequest(params);

      const response = await fetch(`${this.baseUrl}/fapi/v1/leverage?${signedQuery}`, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to set leverage:', error);
      return false;
    }
  }

  async placeOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    stopLoss?: number,
    takeProfit?: number,
    leverage?: number,
    hedgingMode: boolean = true,
    overridePositionSide?: 'LONG' | 'SHORT'
  ): Promise<OrderResult | null> {
    try {
      if (!this.apiKey || !this.apiSecret) {
        await storage.createLog({
          level: 'error',
          message: 'محاولة تداول بدون مفاتيح API',
          details: 'يرجى ضبط مفاتيح API في الإعدادات'
        });
        return null;
      }

      const formattedSymbol = symbol.replace('/', '');

      if (leverage) {
        await this.setLeverage(formattedSymbol, leverage);
      }

      const formattedQuantity = this.formatQuantity(formattedSymbol, quantity);

      if (parseFloat(formattedQuantity) <= 0) {
        const precision = this.getSymbolPrecision(formattedSymbol);
        const msg = `الكمية المحسوبة (${quantity.toFixed(6)}) صغيرة جداً بالنسبة لدقة هذا الزوج (${precision.quantity} أرقام عشرية). يجب أن تكون الكمية أكبر من ${Math.pow(10, -precision.quantity)}`;
        console.warn(msg);

        await storage.createLog({
          level: 'warning',
          message: `تم إلغاء الأمر لـ ${symbol}: الكمية صغيرة جداً`,
          details: msg
        });
        return null;
      }

      // تحديد جانب المركز للتحوط: BUY = LONG, SELL = SHORT
      // إلا إذا تم تحديد positionSide بشكل صريح (مثل عند إغلاق صفقة)
      const positionSide = overridePositionSide || (side === 'BUY' ? 'LONG' : 'SHORT');
      console.log(`Placing order: ${side} ${formattedQuantity} ${formattedSymbol} (${positionSide})`);

      const orderParams: Record<string, string> = {
        symbol: formattedSymbol,
        side,
        type: 'MARKET',
        quantity: formattedQuantity,
        timestamp: Date.now().toString(),
      };

      if (hedgingMode) {
        orderParams.positionSide = positionSide;
      }

      const signedQuery = this.signRequest(orderParams);

      const response = await fetch(`${this.baseUrl}/fapi/v1/order?${signedQuery}`, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Order failed:', error);

        await storage.createLog({
          level: 'error',
          message: `فشل أمر Binance: ${side} ${symbol}`,
          details: `Code: ${error.code}, Msg: ${error.msg}`
        });

        return null;
      }

      const order = await response.json();

      // في وضع التحوط: وقف الخسارة وجني الأرباح يستخدمان نفس positionSide
      // لكن side معاكس (SELL لإغلاق LONG، BUY لإغلاق SHORT)
      const closeSide = side === 'BUY' ? 'SELL' : 'BUY';
      const closePositionSide = side === 'BUY' ? 'LONG' : 'SHORT';

      if (stopLoss) {
        await this.placeStopLoss(formattedSymbol, closeSide, quantity, stopLoss, closePositionSide);
      }

      if (takeProfit) {
        await this.placeTakeProfit(formattedSymbol, closeSide, quantity, takeProfit, closePositionSide);
      }

      return {
        orderId: order.orderId.toString(),
        symbol,
        side,
        price: parseFloat(order.avgPrice) || parseFloat(order.price) || 0,
        quantity: parseFloat(order.executedQty),
        status: order.status,
      };
    } catch (error) {
      console.error('Failed to place order:', error);
      return null;
    }
  }

  private async placeStopLoss(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    positionSide: 'LONG' | 'SHORT' = 'LONG'
  ): Promise<boolean> {
    try {
      const formattedQuantity = this.formatQuantity(symbol, quantity);
      const formattedPrice = this.formatPrice(symbol, price);

      const params: Record<string, string> = {
        symbol,
        side,
        positionSide,
        type: 'STOP_MARKET',
        stopPrice: formattedPrice,
        quantity: formattedQuantity,
        timestamp: Date.now().toString(),
      };

      const signedQuery = this.signRequest(params);

      const response = await fetch(`${this.baseUrl}/fapi/v1/order?${signedQuery}`, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to place stop loss:', error);
      return false;
    }
  }

  private async placeTakeProfit(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    positionSide: 'LONG' | 'SHORT' = 'LONG'
  ): Promise<boolean> {
    try {
      const formattedQuantity = this.formatQuantity(symbol, quantity);
      const formattedPrice = this.formatPrice(symbol, price);

      const params: Record<string, string> = {
        symbol,
        side,
        positionSide,
        type: 'TAKE_PROFIT_MARKET',
        stopPrice: formattedPrice,
        quantity: formattedQuantity,
        timestamp: Date.now().toString(),
      };

      const signedQuery = this.signRequest(params);

      const response = await fetch(`${this.baseUrl}/fapi/v1/order?${signedQuery}`, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to place take profit:', error);
      return false;
    }
  }

  async closePosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    quantity: number,
    hedgingMode: boolean = true
  ): Promise<OrderResult | null> {
    // عند إغلاق صفقة، نستخدم الاتجاه المعاكس مع نفس positionSide
    // إغلاق LONG = SELL مع positionSide=LONG
    // إغلاق SHORT = BUY مع positionSide=SHORT
    const closeSide = side === 'LONG' ? 'SELL' : 'BUY';
    console.log(`Closing position: ${closeSide} ${quantity} ${symbol} (positionSide: ${side}, hedging: ${hedgingMode})`);

    // استخدام placeOrder مع تحديد positionSide صريحاً
    const result = await this.placeOrder(
      symbol,
      closeSide,
      quantity,
      undefined, // no stop loss needed when closing
      undefined, // no take profit needed when closing
      undefined, // no leverage change
      hedgingMode,
      hedgingMode ? side : undefined // override positionSide only in hedging mode
    );

    if (result) {
      console.log(`Position closed successfully: ${symbol} ${side}`);
    }

    return result;
  }

  calculatePositionSize(
    balance: number,
    riskPercent: number,
    entryPrice: number,
    stopLossPrice: number,
    leverage: number = 1
  ): number {
    // الحد الأقصى للقيمة الاسمية = الرصيد المتاح * الرافعة المالية
    const maxNotionalValue = balance * leverage;

    // الحد الأقصى للكمية بناءً على الهامش المتاح
    const maxQuantityByMargin = maxNotionalValue / entryPrice;

    // حساب المخاطرة
    const riskAmount = balance * (riskPercent / 100);
    const priceDifference = Math.abs(entryPrice - stopLossPrice);

    if (priceDifference === 0) return 0;

    // الكمية بناءً على المخاطرة
    const quantityByRisk = riskAmount / priceDifference;

    // استخدام الأقل بين الكميتين لضمان عدم تجاوز الهامش
    // واستخدام 50% فقط من الهامش المتاح للأمان
    const safeMaxQuantity = maxQuantityByMargin * 0.5;
    const positionSize = Math.min(quantityByRisk, safeMaxQuantity);

    console.log(`Position sizing: balance=$${balance}, maxNotional=$${maxNotionalValue}, quantity=${positionSize}`);

    return positionSize;
  }

  calculateStopLoss(
    entryPrice: number,
    isLong: boolean,
    riskPercent: number = 2
  ): number {
    const stopDistance = entryPrice * (riskPercent / 100);
    return isLong
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;
  }

  calculateTakeProfit(
    entryPrice: number,
    stopLossPrice: number,
    isLong: boolean,
    riskRewardRatio: number = 1.5
  ): number {
    const riskDistance = Math.abs(entryPrice - stopLossPrice);
    const profitDistance = riskDistance * riskRewardRatio;
    return isLong
      ? entryPrice + profitDistance
      : entryPrice - profitDistance;
  }

  // Get all open orders for a symbol
  async getOpenOrders(symbol: string): Promise<any[]> {
    try {
      const formattedSymbol = symbol.replace('/', '');
      const params: Record<string, string> = {
        symbol: formattedSymbol,
        timestamp: Date.now().toString(),
      };

      const signedQuery = this.signRequest(params);

      const response = await fetch(`${this.baseUrl}/fapi/v1/openOrders?${signedQuery}`, {
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      if (response.ok) {
        return await response.json();
      }

      return [];
    } catch (error) {
      console.error('Failed to get open orders:', error);
      return [];
    }
  }

  // Cancel a specific order by orderId
  async cancelOrder(symbol: string, orderId: number): Promise<boolean> {
    try {
      const formattedSymbol = symbol.replace('/', '');
      const params: Record<string, string> = {
        symbol: formattedSymbol,
        orderId: orderId.toString(),
        timestamp: Date.now().toString(),
      };

      const signedQuery = this.signRequest(params);

      const response = await fetch(`${this.baseUrl}/fapi/v1/order?${signedQuery}`, {
        method: 'DELETE',
        headers: {
          'X-MBX-APIKEY': this.apiKey,
        },
      });

      if (response.ok) {
        console.log(`Cancelled order ${orderId} for ${symbol}`);
        return true;
      }

      const errorText = await response.text();
      console.error(`Failed to cancel order ${orderId}:`, errorText);
      return false;
    } catch (error) {
      console.error('Failed to cancel order:', error);
      return false;
    }
  }

  // Cancel only STOP_MARKET orders for a symbol (preserves take-profit orders)
  async cancelStopLossOrders(symbol: string, positionSide: 'LONG' | 'SHORT'): Promise<boolean> {
    try {
      const openOrders = await this.getOpenOrders(symbol);

      // Filter for STOP_MARKET orders with matching positionSide
      const stopOrders = openOrders.filter(
        (order: any) => order.type === 'STOP_MARKET' && order.positionSide === positionSide
      );

      if (stopOrders.length === 0) {
        console.log(`No stop loss orders found for ${symbol} ${positionSide}`);
        return true;
      }

      // Cancel each stop order
      let allCancelled = true;
      for (const order of stopOrders) {
        const cancelled = await this.cancelOrder(symbol, order.orderId);
        if (!cancelled) {
          allCancelled = false;
        }
      }

      console.log(`Cancelled ${stopOrders.length} stop loss orders for ${symbol} ${positionSide}`);
      return allCancelled;
    } catch (error) {
      console.error('Failed to cancel stop loss orders:', error);
      return false;
    }
  }

  // Update stop loss to a new price (cancel old stop orders only, preserve take-profit)
  async updateStopLossOrder(
    symbol: string,
    positionSide: 'LONG' | 'SHORT',
    quantity: number,
    newStopPrice: number
  ): Promise<boolean> {
    try {
      const formattedSymbol = symbol.replace('/', '');

      // Cancel only existing stop loss orders (preserve take-profit orders!)
      await this.cancelStopLossOrders(formattedSymbol, positionSide);

      // Place new stop loss at the trailing stop price
      const closeSide = positionSide === 'LONG' ? 'SELL' : 'BUY';
      const success = await this.placeStopLoss(
        formattedSymbol,
        closeSide,
        quantity,
        newStopPrice,
        positionSide
      );

      if (success) {
        console.log(`Updated stop loss for ${symbol} ${positionSide} to $${newStopPrice}`);
      }

      return success;
    } catch (error) {
      console.error('Failed to update stop loss order:', error);
      return false;
    }
  }
}

export const binanceService = new BinanceService();
