-- Literatura: quien recibe una solicitud puede quitarla de su Mi Panel (haya respondido o no). Lo que respondió se conserva.
CREATE TABLE literature_offer_dismissals (
	offer_id TEXT NOT NULL REFERENCES literature_offers(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	dismissed_at INTEGER NOT NULL DEFAULT (unixepoch()),
	PRIMARY KEY (offer_id, user_id)
);
