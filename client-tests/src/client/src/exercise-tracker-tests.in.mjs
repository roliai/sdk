let ENDPOINT;
let USER;
let EXERCISE;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const EVENT_RECEIVE_SLEEP_MS = 1000;
const UPDATE_RECEIVED_SLEEP_MS = 1000;

async function suite0() {
    setLogPrefix("[suite0======]");
    const client = createRoliClient(key, new ServiceOptions(true, true, getLogPrefix()));

    await test('Can round-trip user without unsaved changes error', async function () {
        const endpoint = client.getEndpoint(ExerciseTrackerEndpoint, createUuid(false));
        if (!endpoint)
            throw new Error("Failed to get endpoint");
        const user = await endpoint.addUser(createUuid(false));
        if (!user)
            throw new Error("Failed to add user");
        const exercise = new Exercise(user, "Just testing", 100, new Date());

        let eventReceived = false;
        await client.subscribeEvent(endpoint, ExerciseAdded, async (event) => {
            if (event.exercise.primaryKey !== exercise.primaryKey)
                throw new Error("Unexpected exercise added");
            eventReceived = true;
            await client.unsubscribeEvent(endpoint, ExerciseAdded);
        });

        await endpoint.addExercise(exercise);

        if (!eventReceived)
            throw new Error("Never received exercise added event");
    });

    await test('Can create ExerciseTrackerEndpoint', async function () {
        ENDPOINT = client.getEndpoint(ExerciseTrackerEndpoint, "default");
        if (!ENDPOINT)
            throw new Error("couldn't get the endpoint");
    });

    await test('Can add User', async function () {
        const username = createUuid(false);
        USER = await ENDPOINT.addUser(username);
        if (!USER)
            throw new Error("Returned user was empty");
        if (USER.username !== username)
            throw new Error("Username was: " + USER.username);
    });

    await test('Can see if user exists by username', async function () {
        const exists = await ENDPOINT.userExists(USER.username);
        if (!exists)
            throw new Error('User did not exist');
    });

    await test('Can get user by username', async function () {
        const comp = await ENDPOINT.tryGetUser(USER.username);
        if (!(comp instanceof User))
            throw new Error('comp was not a user instance');
        if (comp.username !== USER.username)
            throw new Error('comp did not have the same username');
    });

    await test('Can get all users', async function () {
        const users = await ENDPOINT.getUsers();
        let found = false;
        for (let user of users) {
            if (!(user instanceof User))
                throw new Error("user was not an instance of User");
            if (user.username === USER.username)
                found = true;
        }
        if (!found)
            throw new Error("User added wasn't present in the returned users");
    });

    await test('Can add exercise', async function () {
        let eventReceived = false;
        let exercise = new Exercise(USER, 'I worked out', 100, new Date());

        await client.subscribeEvent(ENDPOINT, ExerciseAdded, async (event) => {
            if (event.exercise.primaryKey !== exercise.primaryKey)
                throw new Error("Unexpected exercise added");
            eventReceived = true;
            EXERCISE = exercise;
            await client.unsubscribeEvent(ENDPOINT, ExerciseAdded);
        });

        //Wait for suite1 to subscribe to the event before calling the endpoint method which fires the event
        await barrierWait('SUITE1-HAS-SUBSCRIBED-EXERCISE-ADDED');

        await ENDPOINT.addExercise(exercise);

        //Tell suite1 the event has been fired and it should have recieved the event now.
        await barrierWait('SUITE0-HAS-FIRED-EXERCISE-ADDED');

        if (!eventReceived)
            throw new Error("Suite0 didn't receive the event.");
    });

    await test('Can delete exercise', async function () {
        let exercises = await ENDPOINT.getExercises();

        // wait for suite1 to subscribe before deleting the objects.
        await barrierWait('SUITE1-HAS-SUBSCRIBED-EXERCISE-UPDATE');

        for (let exercise of exercises) {
            await ENDPOINT.deleteExercise(exercise.primaryKey);
        }

        // tell suite1 the exercises have been deleted and it should have received the updates by now.
        await barrierWait('SUITE0-HAS-DELETED-EXERCISES');

        exercises = await ENDPOINT.getExercises();
        if (exercises.length !== 0)
            throw new Error("Invalid number of exercises after delete");
    });

    await test('Can delete created user', async function () {
        await ENDPOINT.deleteUser(USER);
        const exists = await ENDPOINT.userExists(USER.username);
        if (exists)
            throw new Error('User existed after delete');
    });

    return client;
}

async function suite1() {
    setLogPrefix("[======suite1]");

    const client = createRoliClient(key, new ServiceOptions(true, true, getLogPrefix()));

    await test('Can get endpoint', async function () {
        ENDPOINT = client.getEndpoint(ExerciseTrackerEndpoint, "default");
        if (!ENDPOINT)
            throw new Error("couldn't get the endpoint");
    });

    await test('Can receive ExerciseAdded event', async function () {
        let eventReceived = false;

        await client.subscribeEvent(ENDPOINT, ExerciseAdded, async (event) => {
            if (!event instanceof ExerciseAdded)
                throw new Error("event was not an ExerciseAdded")
            if (!event.exercise instanceof Exercise)
                throw new Error("event.exercise was not an Exercise");
            eventReceived = true;
            await client.unsubscribeEvent(ENDPOINT, ExerciseAdded);
        });

        // Tell suite0 it's OK to fire the event now.
        await barrierWait('SUITE1-HAS-SUBSCRIBED-EXERCISE-ADDED');

        // Wait for suite0 to have fired the exercise added event
        await barrierWait('SUITE0-HAS-FIRED-EXERCISE-ADDED');

        if(!eventReceived) {
            await sleep(EVENT_RECEIVE_SLEEP_MS);
        }

        if (!eventReceived)
            throw new Error("Suite1 didn't receive the event.");
    })

    await test('Can receive deleted Exercise object update message', async function () {
        const exercises = await ENDPOINT.getExercises();
        await client.subscribeUpdates(exercises);
        let toDelete = new Set(exercises);
        let handled = false;
        for (let exercise of exercises) {
            client.addUpdateListener(exercise, e => {
                handled = true;
                if (e.deleted) {
                    if (!toDelete.delete(e.target))
                        throw new Error("Deleted object that wasn't supposed to exist");
                } else {
                    throw new Error("Unexpected non-delete object update received");
                }
            });
        }

        // Tell suite0 it's OK to delete the exercises now because we're ready to receive the updates.
        await barrierWait('SUITE1-HAS-SUBSCRIBED-EXERCISE-UPDATE');

        // wait for suite0 to have deleted the exercises
        await barrierWait('SUITE0-HAS-DELETED-EXERCISES');

        if(!handled) {
            await sleep(UPDATE_RECEIVED_SLEEP_MS);
        }

        if (!handled)
            throw new Error("No object update message was handled by the listener");

        if (toDelete.size > 0)
            throw new Error(`Not all object updates were recieved. ${toDelete.size} missing`);
    });

    client.closeConnections();
}

run([suite0, suite1], () => {
    if (typeof window !== 'undefined') {
        window.close();
    }
});