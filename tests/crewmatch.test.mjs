import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCrewParticipants,
  canAddCrewParticipant,
  canRemoveCrewParticipant,
  MIN_CREW_SIZE,
  MAX_CREW_SIZE,
} from "../src/lib/crew-validation.ts";

test("1. Crew size and name validation", () => {
  assert.equal(MIN_CREW_SIZE, 3);
  assert.equal(MAX_CREW_SIZE, 8);

  assert.match(validateCrewParticipants([]), /3 to 8/);
  assert.match(validateCrewParticipants([{ name: "Alice" }, { name: "Bob" }]), /3 to 8/);
  assert.match(validateCrewParticipants(Array.from({ length: 9 }, (_, i) => ({ name: `User ${i}` }))), /3 to 8/);
  assert.match(validateCrewParticipants([{ name: "Alice" }, { name: "   " }, { name: "Charlie" }]), /needs a name/);
  assert.match(validateCrewParticipants([{ name: "A".repeat(81) }, { name: "B" }, { name: "C" }]), /needs a name/);
  assert.equal(validateCrewParticipants([{ name: "Alice" }, { name: "Bob" }, { name: "Charlie" }]), null);

  assert.equal(canAddCrewParticipant(3), true);
  assert.equal(canAddCrewParticipant(7), true);
  assert.equal(canAddCrewParticipant(8), false);

  assert.equal(canRemoveCrewParticipant(4), true);
  assert.equal(canRemoveCrewParticipant(3), false);
});

test("2. Garment category mapping logic", () => {
  function mapCategory(cat) {
    const lower = (cat || "").toLowerCase();
    if (lower.includes("top") || lower.includes("shirt") || lower.includes("tee") || lower.includes("jacket") || lower.includes("blazer") || lower.includes("coat") || lower.includes("hoodie")) {
      return "upper_body";
    }
    if (lower.includes("bottom") || lower.includes("pant") || lower.includes("jean") || lower.includes("short") || lower.includes("skirt") || lower.includes("trouser")) {
      return "lower_body";
    }
    if (lower.includes("dress") || lower.includes("suit") || lower.includes("gown") || lower.includes("jumpsuit") || lower.includes("overall")) {
      return "full_body";
    }
    if (lower.includes("shoe") || lower.includes("sneaker") || lower.includes("boot") || lower.includes("heel") || lower.includes("sandal")) {
      return "shoes";
    }
    return "auto";
  }

  assert.equal(mapCategory("top"), "upper_body");
  assert.equal(mapCategory("Classic T-Shirt"), "upper_body");
  assert.equal(mapCategory("Denim Jeans"), "lower_body");
  assert.equal(mapCategory("Evening Silk Gown"), "full_body");
  assert.equal(mapCategory("Leather Boots"), "shoes");
  assert.equal(mapCategory("unknown"), "auto");
});
