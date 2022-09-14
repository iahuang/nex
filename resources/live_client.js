const WS_URL = "ws://" + window.location.host + "/ws";

let socket = new WebSocket(WS_URL);

socket.addEventListener("message", (event) => {
    let { bodyHTML, javascriptCodeFragment } = JSON.parse(event.data);
    document.body.innerHTML = bodyHTML;
    eval(javascriptCodeFragment);
});

socket.addEventListener("close", () => {
    document.body.innerHTML += `
<div class="dir-connection-lost">
    Connection lost; please refresh the page
</div>
`;
});

function requestOpen(path) {
    socket.send(path);
}
