(async () => {
    const base = 'http://localhost:4000';
    const log = (tag, obj) => console.log('\n=== ' + tag + ' ===\n', JSON.stringify(obj, null, 2));
    try {
        const ts = Date.now();
        const ownerEmail = `testowner${ts}@example.com`;
        const partEmail = `testpart${ts}@example.com`;

        // Register owner
        let res = await fetch(base + '/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ownerEmail, password: 'password123', name: 'Owner' })
        });
        let data = await res.json();
        if (!res.ok) { console.error('register failed', res.status, data); process.exit(1); }
        log('register', data);
        const token = data.token;
        const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

        // Create group
        res = await fetch(base + '/api/groups', { method: 'POST', headers, body: JSON.stringify({ name: 'E2E Group' }) });
        data = await res.json();
        if (!res.ok) { console.error('create group failed', res.status, data); process.exit(1); }
        log('group created', data.group);
        const groupId = data.group._id;

        // Add participant
        res = await fetch(base + '/api/participants', {
            method: 'POST',
            headers,
            body: JSON.stringify({ groupId, name: 'Alice', email: partEmail, color: '#ff0000' })
        });
        data = await res.json();
        if (!res.ok) { console.error('add participant failed', res.status, data); process.exit(1); }
        log('participant added', data.participant);

        // Refresh group to get populated participants
        res = await fetch(base + `/api/groups/${groupId}`, { headers });
        data = await res.json();
        if (!res.ok) { console.error('get group failed', res.status, data); process.exit(1); }
        log('group data', data.group);
        const ownerParticipantId = data.group.participants[0]._id;

        // Create expense (equal split)
        res = await fetch(base + '/api/expenses', {
            method: 'POST',
            headers,
            body: JSON.stringify({ groupId, description: 'Lunch', category: 'food', amount: 100, date: new Date().toISOString(), payerId: ownerParticipantId, splitMode: 'equal' })
        });
        data = await res.json();
        if (!res.ok) { console.error('create expense failed', res.status, data); process.exit(1); }
        log('expense created', data.expense);

        // Fetch final summary
        res = await fetch(base + `/api/groups/${groupId}`, { headers });
        data = await res.json();
        if (!res.ok) { console.error('final group fetch failed', res.status, data); process.exit(1); }
        log('final summary', data.summary);

        console.log('\nE2E CHECK COMPLETED');
        process.exit(0);
    } catch (e) {
        console.error('E2E ERROR', e);
        process.exit(1);
    }
})();
