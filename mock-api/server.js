const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const records = [];

function getDateOnly(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value || '').slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function buildKey(draft) {
  return `${draft.vehicleId}__${draft.serviceType}__${getDateOnly(draft.requestedAt)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    count: records.length,
    serverTime: new Date().toISOString(),
  });
});

app.get('/service-requests', (_req, res) => {
  res.json({
    items: records,
  });
});

app.post('/service-requests/sync', (req, res) => {
  const { draft, overwrite = false, baseVersion = 0 } = req.body ?? {};

  if (!draft) {
    return res.status(400).json({
      message: '`draft` zorunlu.',
    });
  }

  if (draft.vehicleId === 'ERR-500') {
    return res.status(500).json({
      message: 'Zorunlu demo hatasi: vehicleId ERR-500 oldugu icin 500 donuldu.',
    });
  }

  const key = buildKey(draft);
  const existing = records.find((item) => item.key === key);
  const syncedAt = new Date().toISOString();

  if (!existing) {
    const created = {
      serverId: `server-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      version: 1,
      key,
      draft: clone(draft),
      syncedAt,
    };

    records.push(created);

    return res.status(201).json({
      serverId: created.serverId,
      version: created.version,
      syncedAt: created.syncedAt,
    });
  }

  if (overwrite === true || Number(baseVersion) === existing.version) {
    existing.version += 1;
    existing.draft = clone(draft);
    existing.syncedAt = syncedAt;

    return res.status(overwrite ? 200 : 201).json({
      serverId: existing.serverId,
      version: existing.version,
      syncedAt: existing.syncedAt,
    });
  }

  return res.status(409).json({
    localRecord: clone(draft),
    serverRecord: clone(existing),
    serverVersion: existing.version,
  });
});

app.listen(PORT, () => {
  console.log(`Mock API listening on http://localhost:${PORT}`);
});
