import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// ── 결재 (Approvals) ──────────────────────────────────────────────────────────

app.get('/api/approvals', (req, res) => {
  res.json(db.prepare('SELECT * FROM approvals ORDER BY created DESC').all());
});

app.post('/api/approvals', (req, res) => {
  const { id, title, requester, approver, status, created, amount } = req.body;
  db.prepare(`INSERT INTO approvals (id,title,requester,approver,status,created,amount) VALUES (?,?,?,?,?,?,?)`)
    .run(id, title, requester, approver, status || 'pending', created, amount || '—');
  res.json({ ok: true });
});

app.patch('/api/approvals/:id', (req, res) => {
  const { status, decided, reason } = req.body;
  db.prepare('UPDATE approvals SET status=?, decided=?, reason=? WHERE id=?')
    .run(status, decided || null, reason || null, req.params.id);
  res.json({ ok: true });
});

// ── 일정 (Events) ────────────────────────────────────────────────────────────

app.get('/api/events', (req, res) => {
  res.json(db.prepare('SELECT * FROM events ORDER BY start_date ASC').all());
});

app.post('/api/events', (req, res) => {
  const { id, title, start_date, time, shared, color, owner, desc, ai, ai_reason } = req.body;
  db.prepare(`INSERT INTO events (id,title,start_date,time,shared,color,owner,desc,ai,ai_reason) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(id, title, start_date, time || '', shared ? 1 : 0, color || 'var(--primary)', owner || 'u_me', desc || null, ai ? 1 : 0, ai_reason || null);
  res.json({ ok: true });
});

app.delete('/api/events/:id', (req, res) => {
  db.prepare('DELETE FROM events WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── 게시판 (Boards) ──────────────────────────────────────────────────────────

app.get('/api/boards/posts', (req, res) => {
  const { type } = req.query;
  const rows = type
    ? db.prepare('SELECT * FROM board_posts WHERE type=? ORDER BY pinned DESC, date DESC').all(type)
    : db.prepare('SELECT * FROM board_posts ORDER BY pinned DESC, date DESC').all();
  res.json(rows);
});

app.post('/api/boards/posts', (req, res) => {
  const { id, type, title, content, author, date } = req.body;
  db.prepare(`INSERT INTO board_posts (id,type,title,content,author,date) VALUES (?,?,?,?,?,?)`)
    .run(id, type, title, content || '', author, date);
  res.json({ ok: true });
});

app.get('/api/boards/posts/:id/comments', (req, res) => {
  res.json(db.prepare('SELECT * FROM board_comments WHERE post_id=? ORDER BY id ASC').all(req.params.id));
});

app.post('/api/boards/posts/:id/comments', (req, res) => {
  const { author, text, time } = req.body;
  db.prepare(`INSERT INTO board_comments (post_id,author,text,time) VALUES (?,?,?,?)`)
    .run(req.params.id, author, text, time);
  db.prepare('UPDATE board_posts SET comments_count = comments_count + 1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── 채팅 (Chat) ──────────────────────────────────────────────────────────────

app.get('/api/chats', (req, res) => {
  res.json(db.prepare('SELECT * FROM chat_rooms ORDER BY time DESC').all());
});

app.post('/api/chats', (req, res) => {
  const { id, name, group_chat, members, last, time } = req.body;
  db.prepare(`INSERT INTO chat_rooms (id,name,group_chat,members,last,time,unread) VALUES (?,?,?,?,?,?,0)`)
    .run(id, name, group_chat ? 1 : 0, JSON.stringify(members), last || '', time || '');
  res.json({ ok: true });
});

app.get('/api/chats/:id/messages', (req, res) => {
  res.json(db.prepare('SELECT * FROM chat_messages WHERE room_id=? ORDER BY id ASC').all(req.params.id));
});

app.post('/api/chats/:id/messages', (req, res) => {
  const { from_user, text, time } = req.body;
  db.prepare(`INSERT INTO chat_messages (room_id,from_user,text,time) VALUES (?,?,?,?)`)
    .run(req.params.id, from_user, text, time);
  db.prepare('UPDATE chat_rooms SET last=?, time=?, unread=0 WHERE id=?').run(text, time, req.params.id);
  res.json({ ok: true });
});

app.patch('/api/chats/:id/read', (req, res) => {
  db.prepare('UPDATE chat_rooms SET unread=0 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── 메일 (Mail) ──────────────────────────────────────────────────────────────

app.get('/api/mails', (req, res) => {
  res.json(db.prepare('SELECT * FROM mails ORDER BY rowid DESC').all());
});

app.patch('/api/mails/:id', (req, res) => {
  const fields = Object.entries(req.body)
    .map(([k]) => `${k}=?`).join(', ');
  const values = [...Object.values(req.body), req.params.id];
  db.prepare(`UPDATE mails SET ${fields} WHERE id=?`).run(...values);
  res.json({ ok: true });
});

app.get('/api/mails/sent', (req, res) => {
  res.json(db.prepare('SELECT * FROM sent_mails ORDER BY rowid DESC').all());
});

app.post('/api/mails/sent', (req, res) => {
  const { id, to_user, subject, preview, time, has_attach } = req.body;
  db.prepare(`INSERT INTO sent_mails (id,to_user,subject,preview,time,has_attach) VALUES (?,?,?,?,?,?)`)
    .run(id, to_user, subject, preview || '', time, has_attach ? 1 : 0);
  res.json({ ok: true });
});

// ── 업무 (Tasks) ─────────────────────────────────────────────────────────────

app.get('/api/tasks', (req, res) => {
  const { assignee } = req.query;
  const rows = assignee
    ? db.prepare('SELECT * FROM tasks WHERE assignee=?').all(assignee)
    : db.prepare('SELECT * FROM tasks').all();
  res.json(rows);
});

app.post('/api/tasks', (req, res) => {
  const { id, title, col, assignee, due, tag, priority } = req.body;
  db.prepare(`INSERT INTO tasks (id,title,col,assignee,due,tag,priority) VALUES (?,?,?,?,?,?,?)`)
    .run(id, title, col || 'todo', assignee, due || '', tag || '', priority || 'mid');
  res.json({ ok: true });
});

app.patch('/api/tasks/:id', (req, res) => {
  const { col } = req.body;
  db.prepare('UPDATE tasks SET col=? WHERE id=?').run(col, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── 헬스 체크 ─────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`ANG backend running on http://localhost:${PORT}`);
});
