-- coins: 儲存幣種資訊
DROP TABLE IF coins;
CREATE TABLE coins (
    coin_id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL, -- e.g., BTC
    name VARCHAR(50) NOT NULL, -- e.g., Bitcoin
    current_price DECIMAL, -- 當前價格 (USD)
    change_24h DECIMAL -- 24小時漲跌幅 (%)
);

-- price_history: 儲存歷史價格
DROP TABLE IF price_history;
CREATE TABLE price_history (
    history_id SERIAL PRIMARY KEY,
    coin_id INTEGER REFERENCES coins(coin_id),
    timestamp TIMESTAMP NOT NULL,
    price DECIMAL NOT NULL
);

-- users: 用戶
DROP TABLE IF users;
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(50) NOT NULL -- 明文密碼（依你的要求不加密）
);

-- wallets: 錢包;
DROP TABLE IF wallets;
CREATE TABLE wallets (
    wallet_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    coin_id INTEGER, -- 0 表示 USD，其餘對應 coins.coin_id
    balance DECIMAL NOT NULL -- 餘額（USD或幣種數量）
);

-- transactions: 交易記錄
DROP TABLE IF transactions;
CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    coin_id INTEGER REFERENCES coins(coin_id),
    type VARCHAR(4) NOT NULL, -- 'BUY' or 'SELL'
    amount DECIMAL NOT NULL, -- 交易數量（幣種數量）
    price DECIMAL NOT NULL, -- 成交價格 (USD)
    timestamp TIMESTAMP NOT NULL
);

-- 初始化 5 幣種
INSERT INTO coins (coin_id, symbol, name, current_price, change_24h) VALUES
(1, 'BTC', 'Bitcoin', 0, 0),
(2, 'ETH', 'Ethereum', 0, 0),
(3, 'BNB', 'Binance Coin', 0, 0),
(4, 'ADA', 'Cardano', 0, 0),
(5, 'XRP', 'Ripple', 0, 0);

-- 初始化測試用戶
INSERT INTO users (user_id, username, password) VALUES (1, 'testuser', 'test123');

-- 初始化錢包（1000 USD）
INSERT INTO wallets (user_id, coin_id, balance) VALUES (1, 0, 1000);