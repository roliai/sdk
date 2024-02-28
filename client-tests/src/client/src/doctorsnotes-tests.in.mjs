let ENDPOINT;
let CLIENT;

const DEFAULT_ENDPOINT = "default";

async function suite() {
    setLogPrefix("[suite]");
    
    CLIENT = createRoliClient(new ServiceOptions(true, true, getLogPrefix()));

    await test('Can create Api Endpoint', async function () {
        ENDPOINT = CLIENT.getEndpoint(Api, DEFAULT_ENDPOINT);
        if (!ENDPOINT)
            throw new Error("couldn't get the endpoint");
    });

    await test("Can generate a structured doctor's note", async function () {
        const unstructuredNote = `38 y/o M w/ h/o intermittent back pain, presents w/ severe lumbar pain x1 wk, no known injury. Pain > with movement, sitting/standing, < when lying down. NSAIAs limited relief. PE: Localized lower back pain, ↓ lumbar ROM due to pain. SLR -ve bilaterally. Neuro exam NAD. Lumbar X-ray unremarkable, no spondylosis/fracture/dislocation.

Severe nonspecific LBP, musculoskeletal likely.
 
Rx Cyclobenzaprine 10mg TID PRN. Advise rest, avoid strenuous activity. PT advised. F/u in 2 wks or if pain ↑. Referral if no improvement.
 
Pt educated re: lifestyle changes, back care ergonomics. Agreed to follow recommendations.`;
         

        // todo: fill in this
        const encounter = {
            uuid: 55,
            patient: {
                firstName: "Simon",
                lastName: "Ellis"
            },
            reasonForVisit: "back pain",
            provider: {
                firstName: "Scott",
                lastName: "McNulty",
                credentials: "MD from the Harvard School of Medicine"
            }
        };
        
        const followUpPlans = [];

        const structuredNote = await ENDPOINT.createStructuredNote(encounter, 
            unstructuredNote, followUpPlans);
            
        if(!structuredNote) {
            assert.fail('structuredNote was empty');
        }

        if(typeof structuredNote !== 'object'){
            assert.fail("structuredNote wasn't an object");
        }
        
        // sj note:
        // I got these numbers by running it once and rounding down the size of each property's value.
        // There's a big chance these numbers need to be updated at some point but this is reasonable.
        
        // sj note:
        // Just update these numbers with the new lowest each time they fail.

        assert.stringMinLength(structuredNote.subjective, 250);
        assert.stringMinLength(structuredNote.objective, 250);
        assert.stringMinLength(structuredNote.assessment, 50);
        assert.stringMinLength(structuredNote.plan, 300);
        assert.stringMinLength(structuredNote.patientSummary, 1800);

        // The number 4 here is 1 less than the test run returned with 5.
        assert.isArrayWithMinLength(structuredNote.possibleDiagnoses, 4);

        for(let i=0; i < structuredNote.possibleDiagnoses.length; ++i) {
            const pd = structuredNote.possibleDiagnoses[i];
            assert.stringMinLength(pd.code, 3); //ICD 10 codes can be between 3 and 7 characters
            assert.stringMinLength(pd.description, 7);
            assert.stringMinLength(pd.reasoning, 100);
        }
    });
}

async function suite_() {
    try {
       await suite();
    } finally {
        CLIENT.closeConnections();
    }
}

run(suite_, () => {
    if (typeof window !== 'undefined') {
        window.close();
    }
});