-- Módulo «Literatura» (lib/literature). Acceso: admin o el privilegio «Administrar → Literatura», que recibe solo el siervo de
-- literatura (nombramiento `literature_servant`) y a sus auxiliares se otorga a mano.
INSERT INTO privileges (id, code, name, category, is_system_defined) VALUES
	('priv_literature_access', 'literature_access', 'Literatura', 'administrative', 1);

INSERT INTO appointment_privilege_rules (id, privilege_id, appointment_type, requires_competency_flag) VALUES
	('rule_literature_access_literature_servant', 'priv_literature_access', 'literature_servant', 0);

-- Catálogo de publicaciones: el de la Biblioteca de JW.ORG (en español; `source='jw'`, se actualiza en el job diario) más las que se
-- agregan a mano (`source='manual'`). `issue` es el número de una revista (AAAA-MM) y vacío para lo demás. Las de JW.ORG tienen
-- un id fijo (`pub_<código>[_<número>]`) para que sea el mismo en todas las instalaciones.
CREATE TABLE literature_publications (
	id TEXT PRIMARY KEY NOT NULL,
	code TEXT NOT NULL,
	issue TEXT NOT NULL DEFAULT '',
	title TEXT NOT NULL,
	category TEXT NOT NULL CHECK (category IN ('bible', 'book', 'brochure', 'tract', 'magazine', 'other')),
	image_url TEXT,
	source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('jw', 'manual')),
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX literature_publications_code_issue_idx ON literature_publications(code, issue);

-- Dónde se guarda la literatura (bodega, mostrador, carrito…): en el inventario solo se elige.
CREATE TABLE literature_locations (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX literature_locations_name_idx ON literature_locations(name);

-- Inventario: cada corte es un conteo en una fecha; sus líneas, cuántas hay de cada publicación en cada ubicación.
CREATE TABLE literature_inventories (
	id TEXT PRIMARY KEY NOT NULL,
	count_date TEXT NOT NULL,
	notes TEXT,
	created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX literature_inventories_date_idx ON literature_inventories(count_date);

CREATE TABLE literature_inventory_items (
	id TEXT PRIMARY KEY NOT NULL,
	inventory_id TEXT NOT NULL REFERENCES literature_inventories(id) ON DELETE CASCADE,
	publication_id TEXT NOT NULL REFERENCES literature_publications(id),
	location_id TEXT NOT NULL REFERENCES literature_locations(id),
	quantity INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX literature_inventory_items_unique_idx ON literature_inventory_items(inventory_id, publication_id, location_id);

-- Solicitudes: el siervo o un auxiliar ofrece una publicación a los publicadores o a los superintendentes de grupo; cada uno responde
-- Sí (con cantidad) o No desde Mi Panel hasta `ends_on` (inclusive). Al vencer deja de verse en Mi Panel; la lista queda.
CREATE TABLE literature_offers (
	id TEXT PRIMARY KEY NOT NULL,
	publication_id TEXT NOT NULL REFERENCES literature_publications(id),
	audience TEXT NOT NULL CHECK (audience IN ('publishers', 'group_overseers')),
	message TEXT,
	ends_on TEXT NOT NULL,
	notified_at INTEGER,
	created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
	created_at INTEGER NOT NULL DEFAULT (unixepoch()),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX literature_offers_ends_idx ON literature_offers(ends_on);

CREATE TABLE literature_offer_responses (
	offer_id TEXT NOT NULL REFERENCES literature_offers(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	answer TEXT NOT NULL CHECK (answer IN ('yes', 'no')),
	quantity INTEGER NOT NULL DEFAULT 1,
	responded_at INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (offer_id, user_id)
);
