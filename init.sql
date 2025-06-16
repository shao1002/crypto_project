DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS wallets;
DROP TABLE IF EXISTS price_history;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS coins;

CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE coins (
    coin_id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    current_price DECIMAL(10, 2) NOT NULL,
    change_24h DECIMAL
);

CREATE TABLE price_history (
    id SERIAL PRIMARY KEY,
    coin_id INTEGER REFERENCES coins(coin_id),
    timestamp TIMESTAMP,
    price DECIMAL
);

CREATE TABLE wallets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    coin_id INTEGER REFERENCES coins(coin_id),
    balance DECIMAL(15, 2) NOT NULL,
    UNIQUE (user_id, coin_id)
);

CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    coin_id INTEGER REFERENCES coins(coin_id),
    type VARCHAR(4) CHECK (type IN ('BUY', 'SELL')),
    amount DECIMAL(15, 2) NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);