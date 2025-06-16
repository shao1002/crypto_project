const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const pool = require('./db');
const bcrypt = require('bcryptjs'); // 假設已替換為 bcryptjs
const app = express();

const saltRounds = 10; // 定義 saltRounds 供 bcrypt 使用
const DEFAULT_COIN_ID = 0; // 預設 coin_id
const PUBLIC_DIR = 'public'; // 靜態文件目錄

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR)); // 提供前端檔案

// 獲取幣種列表
app.get('/api/coins', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM coins');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 獲取歷史價格
app.get('/api/coins/:id/history', async (req, res) => {
  const { id } = req.params;
  const { range } = req.query; // 1h, 1d, 1w, 1m
  let interval;
  switch (range) {
    case '1h': interval = "1 hour"; break;
    case '1d': interval = "1 day"; break;
    case '1w': interval = "1 week"; break;
    case '1m': interval = "1 month"; break;
    default: interval = "1 day";
  }
  try {
    const result = await pool.query(
      `SELECT timestamp, price FROM price_history 
       WHERE coin_id = $1 AND timestamp >= NOW() - INTERVAL $2 
       ORDER BY timestamp`,
      [id, interval]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 註冊
app.post('/api/users/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *',
      [username, hashedPassword]
    );
    const userId = result.rows[0].user_id;
    await pool.query('INSERT INTO wallets (user_id, coin_id, balance) VALUES ($1, $2, 1000)', [userId, DEFAULT_COIN_ID]);
    res.status(201).json({ message: '註冊成功' });
  } catch (err) {
    if (err.code === '23505') { // 唯一約束違反（用戶名重複）
      res.status(400).json({ message: '用戶名已存在' });
    } else {
      res.status(500).json({ message: '伺服器錯誤', error: err.message });
    }
  }
});

// 登錄
app.post('/api/users/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT user_id, username, password FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: '用戶名不存在' });
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      res.json({ user_id: user.user_id, username: user.username });
    } else {
      res.status(401).json({ message: '密碼錯誤' });
    }
  } catch (err) {
    res.status(500).json({ message: '伺服器錯誤', error: err.message });
  }
});

// 獲取錢包
app.get('/api/users/:id/wallet', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 執行交易
app.post('/api/transactions', async (req, res) => {
  const { user_id, coin_id, type, amount } = req.body;
  try {
    const coin = await pool.query('SELECT current_price FROM coins WHERE coin_id = $1', [coin_id]);
    const price = coin.rows[0].current_price;
    const total = amount * price;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (type === 'BUY') {
        const usdWallet = await client.query('SELECT balance FROM wallets WHERE user_id = $1 AND coin_id = $2', [user_id, DEFAULT_COIN_ID]);
        if (usdWallet.rows[0].balance < total) throw new Error('餘額不足');
        await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND coin_id = $3', [total, user_id, DEFAULT_COIN_ID]);
        await client.query(
          'INSERT INTO wallets (user_id, coin_id, balance) VALUES ($1, $2, $3) ON CONFLICT (user_id, coin_id) DO UPDATE SET balance = wallets.balance + $3',
          [user_id, coin_id, amount]
        );
      } else if (type === 'SELL') {
        const coinWallet = await client.query('SELECT balance FROM wallets WHERE user_id = $1 AND coin_id = $2', [user_id, coin_id]);
        if (coinWallet.rows.length === 0 || coinWallet.rows[0].balance < amount) throw new Error('幣種餘額不足');
        await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id = $2 AND coin_id = $3', [amount, user_id, coin_id]);
        await client.query(
          'INSERT INTO wallets (user_id, coin_id, balance) VALUES ($1, $2, $3) ON CONFLICT (user_id, coin_id) DO UPDATE SET balance = wallets.balance + $3',
          [user_id, DEFAULT_COIN_ID, total]
        );
      }
      await client.query(
        'INSERT INTO transactions (user_id, coin_id, type, amount, price, timestamp) VALUES ($1, $2, $3, $4, $5, NOW())',
        [user_id, coin_id, type, amount, price]
      );
      await client.query('COMMIT');
      res.json({ message: '交易成功' });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 定時更新價格（每5分鐘）
cron.schedule('*/5 * * * *', async () => {
  const coins = [
    { id: 1, symbol: 'BTC' },
    { id: 2, symbol: 'ETH' },
    { id: 3, symbol: 'BNB' },
    { id: 4, symbol: 'ADA' },
    { id: 5, symbol: 'XRP' }
  ];
  for (const coin of coins) {
    try {
      const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${coin.symbol}USDT`);
      const price = parseFloat(response.data.price);
      await pool.query('UPDATE coins SET current_price = $1 WHERE coin_id = $2', [price, coin.id]);
      await pool.query('INSERT INTO price_history (coin_id, timestamp, price) VALUES ($1, NOW(), $2)', [coin.id, price]);
    } catch (err) {
      console.error(`更新 ${coin.symbol} 價格失敗: ${err.message}`);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));