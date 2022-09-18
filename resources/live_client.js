const WS_URL = "ws://" + window.location.host + "/ws";
const RECONNECTION_RETRY_INTERVAL = 1000;

class LiveClient {
    constructor() {
        this._socketInstance = null;
        this._reconnectInterval = null;
    }

    _initSocket() {
        if (!this._socketInstance) {
            throw new Error("Socket hasn't been initialized");
        }

        this._socketInstance.addEventListener("message", (event) => {
            let { bodyHTML, javascriptCodeFragment } = JSON.parse(event.data);
            document.body.innerHTML = bodyHTML;
            eval(javascriptCodeFragment);
        });

        this._socketInstance.addEventListener("close", () => {
            document.body.innerHTML += `
<div class="dir-connection-lost">
    Connection lost; attempting to reconnect...
</div>
`;
            this._attemptReconnect();
        });
    }

    _attemptReconnect() {
        this._socketInstance = null;

        if (this._reconnectInterval === null) {
            this._reconnectInterval = setInterval(async () => {
                let ok = await this.attemptConnection();

                if (ok) {
                    clearInterval(this._reconnectInterval);
                    this._reconnectInterval = null;
                } else {
                    console.log("retrying...");
                }
            }, RECONNECTION_RETRY_INTERVAL);
        } else {
            throw new Error("??");
        }
    }

    getSocket() {
        if (!this._socketInstance) {
            throw new Error("Socket is not currently connected");
        }

        return this._socketInstance;
    }

    /**
     * Attempt websocket connection. Return `true` if the connection succeeded.
     */
    async attemptConnection() {
        let newSocket;

        let ok = await new Promise((resolve) => {
            newSocket = new WebSocket(WS_URL);
            newSocket.addEventListener("error", () => {
                resolve(false);
            });

            newSocket.addEventListener("open", () => {
                resolve(true);
            });
        });

        if (ok) {
            this._socketInstance = newSocket;
            this._initSocket();
            return true;
        }

        return false;
    }
}

let client = new LiveClient();
client.attemptConnection();

function requestOpen(path) {
    client.getSocket().send(path);
}
