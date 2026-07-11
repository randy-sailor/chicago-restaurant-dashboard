import test from "node:test";
import assert from "node:assert/strict";
import { dashboardData, findRestaurant } from "../api/_lib/restaurants.js";

test("dataset parses and has the expected shape", () => {
  const data = dashboardData();
  assert.ok(data.restaurants.length >= 40);
  assert.ok(data.sources.length >= 10);
  assert.ok(data.laneDefs.some((lane) => lane.id === "hot-new"));
});

test("restaurant ids are unique and records are complete", () => {
  const data = dashboardData();
  const ids = new Set();
  for (const restaurant of data.restaurants) {
    assert.ok(restaurant.id, "id required");
    assert.ok(!ids.has(restaurant.id), `duplicate id ${restaurant.id}`);
    ids.add(restaurant.id);
    assert.ok(restaurant.name);
    assert.ok(restaurant.neighborhood);
    assert.ok(Array.isArray(restaurant.lanes) && restaurant.lanes.length > 0, `${restaurant.id} missing lanes`);
    assert.ok(Array.isArray(restaurant.menu));
    assert.ok(Array.isArray(restaurant.sourceIds) && restaurant.sourceIds.length > 0);
  }
});

test("every sourceId resolves to a registered source", () => {
  const data = dashboardData();
  const sourceIds = new Set(data.sources.map((source) => source.id));
  for (const restaurant of data.restaurants) {
    for (const id of restaurant.sourceIds) {
      assert.ok(sourceIds.has(id), `${restaurant.id} references unknown source ${id}`);
    }
  }
});

test("findRestaurant looks up by id and rejects unknowns", () => {
  assert.equal(findRestaurant("kasama")?.name, "Kasama");
  assert.equal(findRestaurant("does-not-exist"), null);
  assert.equal(findRestaurant(""), null);
});
