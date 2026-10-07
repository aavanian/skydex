import { CALLBACK_CHANNEL } from "./auth/channel";

// Login popup landing page: hand the authorization response to the
// page that opened the login, which holds the login state in memory.
const params = location.hash.slice(1) || location.search.slice(1);
const channel = new BroadcastChannel(CALLBACK_CHANNEL);
channel.postMessage(params);
channel.close();
history.replaceState(null, "", location.pathname);
window.close();
