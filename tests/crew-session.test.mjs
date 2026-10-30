import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const dir = mkdtempSync(path.join(tmpdir(), "lookmates-crew-"));
process.env.DATABASE_URL = path.join(dir, "crew.sqlite");
const { getDb } = await import("../src/lib/db.ts");
const { validateCrewParticipants, canAddCrewParticipant, canRemoveCrewParticipant } = await import("../src/lib/crew-validation.ts");

test("crew validation requires a named group of three to eight", () => {
  assert.match(validateCrewParticipants([]), /3 to 8/);
  assert.match(validateCrewParticipants([{ name: "A" }, { name: "B" }]), /3 to 8/);
  assert.match(validateCrewParticipants(Array.from({ length: 9 }, (_, i) => ({ name: `P${i}` }))), /3 to 8/);
  assert.match(validateCrewParticipants([{ name: "A" }, { name: " " }, { name: "C" }]), /needs a name/);
  assert.match(validateCrewParticipants([{ name: "x".repeat(81) }, { name: "B" }, { name: "C" }]), /needs a name/);
  assert.equal(validateCrewParticipants([{ name: "A" }, { name: "B" }, { name: "C" }]), null);
  assert.equal(canAddCrewParticipant(7), true);
  assert.equal(canAddCrewParticipant(8), false);
  assert.equal(canRemoveCrewParticipant(4), true);
  assert.equal(canRemoveCrewParticipant(3), false);
});

test("crew participants, names, photos, and outfits persist independently", () => {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO sessions (id, occasion, style_preferences, combined_budget, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run("crew_test", "Wedding", "Coordinated", 0, "INR", now, now);
  const add = db.prepare("INSERT INTO participants (id, session_id, role, display_name, photo_data, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  add.run("c1", "crew_test", "crew_1", "Ari", "data:image/jpeg;base64,one", now);
  add.run("c2", "crew_test", "crew_2", "Bea", "data:image/jpeg;base64,two", now);
  add.run("c3", "crew_test", "crew_3", "Cal", "data:image/jpeg;base64,three", now);
  db.prepare("UPDATE participants SET display_name = ? WHERE id = ? AND session_id = ?").run("Bea L.", "c2", "crew_test");
  db.prepare("INSERT INTO garment_assignments (id, session_id, participant_id, garment_id, status, created_at) VALUES (?, ?, ?, ?, 'assigned', ?)").run("a1", "crew_test", "c1", "garm-top-white-tee", now);
  db.prepare("INSERT INTO garment_assignments (id, session_id, participant_id, garment_id, status, created_at) VALUES (?, ?, ?, ?, 'assigned', ?)").run("a2", "crew_test", "c2", "garm-w2-silk-gown", now);
  const persisted = db.prepare("SELECT p.id, p.display_name, p.photo_data, ga.garment_id FROM participants p LEFT JOIN garment_assignments ga ON ga.participant_id = p.id WHERE p.session_id = ? ORDER BY p.role").all("crew_test");
  assert.equal(persisted.length, 3);
  assert.equal(persisted[0].photo_data, "data:image/jpeg;base64,one");
  assert.equal(persisted[0].garment_id, "garm-top-white-tee");
  assert.equal(persisted[1].display_name, "Bea L.");
  assert.equal(persisted[1].garment_id, "garm-w2-silk-gown");
  assert.equal(persisted[2].garment_id, null);
  db.prepare("DELETE FROM garment_assignments WHERE session_id = ? AND participant_id = ?").run("crew_test", "c2");
  db.prepare("DELETE FROM participants WHERE id = ? AND session_id = ?").run("c2", "crew_test");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM participants WHERE session_id = ?").get("crew_test").count, 2);
  db.prepare("DELETE FROM garment_assignments WHERE session_id = ?").run("crew_test");
  db.prepare("DELETE FROM participants WHERE session_id = ?").run("crew_test");
  db.prepare("DELETE FROM sessions WHERE id = ?").run("crew_test");
});

test.after(() => {
  getDb().close();
  rmSync(dir, { recursive: true, force: true });
});
