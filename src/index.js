const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcryptjs'); // 假設已替換為 bcryptjs
const app = express();
const saltRounds = 10; // 定義 saltRounds 供 bcrypt 使用

// 預設 coin_id，未來可根據需求調整
const DEFAULT_COIN_ID = 0;
const PUBLIC_DIR = 'public';

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR)); // 提供前端檔案

// 後續路由和邏輯...
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
      // 登入成功時僅回傳 user_id 與 username，若需擴充權杖（如 JWT），可於此處加入相關邏輯
      res.json({ user_id: user.user_id, username: user.username });
    } else {
      res.status(401).json({ message: '密碼錯誤' });
    }
  } catch (err) {
    res.status(500).json({ message: '伺服器錯誤', error: err.message });
  }
});