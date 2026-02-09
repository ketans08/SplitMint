export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function equalSplit(total, participantIds) {
  const count = participantIds.length;
  if (count === 0) return [];
  const base = Math.floor((total / count) * 100) / 100;
  let remainder = round2(total - base * count);
  const splits = participantIds.map((id) => ({ participant: id, amount: base }));
  let i = 0;
  while (remainder > 0 && i < splits.length) {
    splits[i].amount = round2(splits[i].amount + 0.01);
    remainder = round2(remainder - 0.01);
    i += 1;
  }
  return splits;
}

export function computeBalances(expenses, participants) {
  const balances = new Map();
  for (const p of participants) balances.set(p._id.toString(), 0);

  for (const exp of expenses) {
    const payerId = exp.payer && exp.payer._id ? exp.payer._id.toString() : exp.payer.toString();
    balances.set(payerId, round2((balances.get(payerId) || 0) + exp.amount));
    for (const split of exp.splits) {
      const pid = split.participant && split.participant._id ? split.participant._id.toString() : split.participant.toString();
      balances.set(pid, round2((balances.get(pid) || 0) - split.amount));
    }
  }

  const result = participants.map((p) => ({
    participant: p,
    net: round2(balances.get(p._id.toString()) || 0)
  }));

  const creditors = [];
  const debtors = [];
  for (const r of result) {
    if (r.net > 0) creditors.push({ ...r });
    if (r.net < 0) debtors.push({ ...r });
  }

  const settlements = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = round2(Math.min(-d.net, c.net));
    if (amount > 0) {
      settlements.push({
        from: d.participant,
        to: c.participant,
        amount
      });
      d.net = round2(d.net + amount);
      c.net = round2(c.net - amount);
    }
    if (d.net === 0) i += 1;
    if (c.net === 0) j += 1;
  }

  return { balances: result, settlements };
}
