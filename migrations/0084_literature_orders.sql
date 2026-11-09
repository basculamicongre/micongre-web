-- Literatura › Pedidos: lo que un publicador pidió por su cuenta (no por una solicitud). Solo es un registro para el siervo de
-- literatura: no se le avisa a nadie. `archived_at` lo saca de la lista (se puede ver con el filtro «Archivados»).
CREATE TABLE literature_orders (
	id TEXT PRIMARY KEY NOT NULL,
	publication_id TEXT NOT NULL REFERENCES literature_publications(id),
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	quantity INTEGER NOT NULL CHECK (quantity > 0),
	note TEXT,
	archived_at INTEGER,
	created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX literature_orders_archived_idx ON literature_orders(archived_at, created_at);
