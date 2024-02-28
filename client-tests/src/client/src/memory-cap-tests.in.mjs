let ENDPOINT;

async function suite() {
    setLogPrefix("[suite]");
    
    const client = createRoliClient(new ServiceOptions(true, true, getLogPrefix()));

    await test('Can create Endpoint', async function () {
        ENDPOINT = client.getEndpoint(MemoryCapEndpoint, "default");
        if (!ENDPOINT)
            throw new Error("couldn't get the endpoint");
    });

    await test('Can explode', async function () {
        let thrown = false;
        try{
            await ENDPOINT.explode();
        }
        catch(e) {
            if(e instanceof PlatformError) {
                if (e.code === "Innerspace_ConnectionFault") {
                    thrown = true;
                    console.log(`Received the expected result`);
                } else {
                    console.log(`Recieved the right exception but an unexpected code ${e.code} with message ${e.message}`);
                }
            } else {
                console.log(`Failed to receive the right exception object. Raw exception: ${JSON.stringify(e)}`);
            }
        }
        if(!thrown)
            throw new Error("Failed to throw from method call that should have crashed the endpoint.");
    });

    client.closeConnections();
}

run(suite, () => {
    if (typeof window !== 'undefined') {
        window.close();
    }
});