const bcrypt = require('bcrypt');
const saltRounds = 10;

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
    await pool.query('INSERT INTO wallets (user_id, coin_id, balance) VALUES ($1, 0, 1000)', [userId]);
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
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
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