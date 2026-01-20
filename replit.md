# Binance Trading Bot

## Overview

This is an automated cryptocurrency trading bot designed for Binance Futures and Spot trading. The application provides a comprehensive dashboard for monitoring trades, analyzing market signals using technical indicators (Moving Averages, RSI, MACD), and managing risk through automated stop-loss and take-profit mechanisms. The bot supports both live trading and testnet environments, with features like hedging mode and multi-pair trading.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- React 18 with TypeScript for type safety and modern component patterns
- Vite as the build tool for fast development and optimized production builds
- Wouter for lightweight client-side routing
- TanStack Query for server state management and caching
- Right-to-left (RTL) layout support for Arabic language interface

**UI Component Library**
- Shadcn/ui components built on Radix UI primitives
- Tailwind CSS for styling with custom design tokens
- Theme system supporting light/dark modes
- Custom color palette optimized for financial dashboards (green for profits, red for losses)
- Recharts for data visualization (line charts, bar charts, area charts)

**State Management Strategy**
- React Query handles all server state with automatic refetching and caching
- Local component state for UI interactions
- Query invalidation strategy ensures data consistency after mutations

**Key Design Patterns**
- Compound component pattern for complex UI elements (cards, forms, dialogs)
- Custom hooks for reusable logic (useIsMobile, useToast, useTheme)
- Form validation using React Hook Form with Zod schemas
- Responsive design with mobile-first approach

### Backend Architecture

**Server Framework**
- Express.js with TypeScript for type-safe API development
- Node.js runtime with ES modules
- HTTP server for REST API endpoints and serving static frontend files

**API Design**
- RESTful endpoints organized by resource type:
  - `/api/settings` - Bot configuration management
  - `/api/trades` - Trade execution and history
  - `/api/signals` - Technical indicator signals
  - `/api/logs` - Activity logging
  - `/api/stats` - Performance metrics
- JSON request/response format
- Request logging middleware for debugging

**Business Logic Organization**
- Service layer pattern separates business logic from routes:
  - `BinanceService` - Handles all Binance API interactions (market data, order execution, account info)
  - `TechnicalIndicators` - Calculates RSI, MACD, Moving Averages and generates trading signals
  - `AdvancedStrategies` - Implements 4 advanced trading strategies (Breakout, Momentum, Mean Reversion, Swing)
  - `AIPredictor` - AI-based market prediction using pattern recognition, momentum analysis, and trend detection
  - `SmartPositionSizing` - ATR-based position sizing with volatility adjustment
  - `MarketFilter` - Market condition analysis and account protection
  - `storage` layer - Abstracts database operations
- Trading strategy hierarchy (analyzed in priority order):
  1. AI Trading - Pattern recognition, momentum, volatility, trend, and price action analysis
  2. Advanced Strategies - Breakout, Momentum, Mean Reversion, Swing trading strategies
  3. Multi-timeframe analysis - Confirmation across 15m, 1h, 4h timeframes
  4. Single timeframe technical analysis - MA, RSI, MACD indicators

**Risk Management System**
- Maximum 2% risk per trade (configurable)
- Risk/reward ratio of 1:1.5 minimum (configurable)
- Position sizing calculated based on account balance and stop-loss distance
- Automatic stop-loss and take-profit order placement

**Smart Position Sizing (New)**
- ATR-based position sizing that adapts to market volatility
- Configurable ATR period (7-50) and multiplier (0.5-5x)
- Minimum and maximum position size as percentage of balance
- Volatility adjustment reduces size in high-volatility markets

**Market Filter (New)**
- Filters trades based on market conditions before execution
- Avoids high volatility periods (configurable threshold)
- Trend filter ensures sufficient trend strength before trading
- Ranging market detection to avoid choppy conditions

**Account Protection (New)**
- Daily loss limit prevents trading after hitting loss threshold
- Maximum concurrent trades limit for portfolio management
- Consecutive loss pause stops trading after multiple losses
- Diversification control limits exposure to single trading pair

**Manual Trade Detection & Management**
- Automatically detects positions opened manually on Binance (not through the bot)
- Imports manual trades into the database with calculated stop loss and take profit based on user settings
- Manual trades are marked with `isAutoTrade: false` and `entrySignals: ['Manual Trade']`
- Trailing stop is applied to manual trades based on user settings
- Hedging mode checks symbol+side to allow LONG and SHORT positions on the same pair

**Real-Time Profit Display**
- Dashboard enriches database trades with live unrealizedPnl from Binance positions
- Profit/loss updates every 10 seconds from /api/account endpoint
- Matches trades to positions using symbol+side (LONG/SHORT) for accurate profit mapping

### Data Storage

**Database System**
- PostgreSQL as the primary database
- Drizzle ORM for type-safe database queries and migrations
- Connection pooling via node-postgres (pg)

**Schema Design**
- `users` - User authentication data
- `bot_settings` - Trading configuration (API keys, indicator parameters, risk settings, trading pairs)
- `trades` - Trade records with entry/exit prices, profit/loss, status tracking
- `signals` - Historical technical indicator signals
- `activity_logs` - System event logging with severity levels
- `market_data` - Cached market price and volume data

**Data Relationships**
- Users have one-to-many relationship with trades
- Settings are linked to users for multi-user support
- Enums for trade types (long/short), status (active/closed/pending/cancelled), signal types, and log levels

### External Dependencies

**Third-Party Services**

1. **Binance API**
   - Futures and Spot trading endpoints
   - Real-time market data (prices, 24h statistics, candlestick data)
   - Order execution and account management
   - Supports both production API and testnet environment
   - Requires API key and secret for authentication
   - Uses HMAC SHA256 signature for request authentication

2. **Optional Notification Services**
   - Telegram Bot API for trade notifications
   - Email notifications (SMTP configuration required)

**Key NPM Dependencies**
- Database: `drizzle-orm`, `pg`, `connect-pg-simple`
- Validation: `zod`, `drizzle-zod`, `zod-validation-error`
- UI Components: `@radix-ui/*` (20+ component primitives)
- Forms: `react-hook-form`, `@hookform/resolvers`
- Charts: `recharts`
- Date handling: `date-fns`
- Session management: `express-session`
- Styling: `tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge`

**Build & Development Tools**
- TypeScript compiler for type checking
- ESBuild for server bundling with allowlist for dependencies
- Vite plugins for development (runtime error overlay, Replit integrations)
- PostCSS with Autoprefixer for CSS processing

**Security Considerations**
- API credentials stored in database (encrypted storage recommended)
- Session-based authentication for web interface
- Environment variables for sensitive configuration
- Testnet mode as default to prevent accidental live trading