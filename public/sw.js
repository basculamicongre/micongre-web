self.addEventListener("push", (event) => {
	let data = { title: "Mi Congre", body: "" };
	try {
		if (event.data) data = event.data.json();
	} catch {
		data = { title: "Mi Congre", body: event.data ? event.data.text() : "" };
	}

	event.waitUntil(
		self.registration.showNotification(data.title || "Mi Congre", {
			body: data.body || "",
			icon: "/icons/icon-192.png",
			badge: "/icons/icon-192.png",
			data: { url: data.url || "/panel" },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/panel";

	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url.includes(url) && "focus" in client) return client.focus();
			}
			if (self.clients.openWindow) return self.clients.openWindow(url);
		}),
	);
});
