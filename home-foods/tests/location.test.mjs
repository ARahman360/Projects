import test from "node:test";
import assert from "node:assert/strict";
import {
  OUTSIDE_FINLAND_MESSAGE, ROUTING_UNAVAILABLE_MESSAGE, distanceKm, getDrivingDistanceMeters,
  getKitchenDeliveryDistance, getKitchenDeliveryDistances, getLocationConfiguration, isWithinDeliveryRadius, suggestFinnishAddresses, verifyAddressText, verifyCoordinates,
} from "../src/lib/location.ts";

const helsinki = {
  properties: {
    formatted: "Mannerheimintie 1, 00100 Helsinki, Finland", street: "Mannerheimintie", housenumber: "1",
    postcode: "00100", city: "Helsinki", country: "Finland", country_code: "fi", lat: 60.1699, lon: 24.9384,
  },
};

test("20 km driving-distance boundary is inclusive and rejects anything farther", () => {
  assert.equal(isWithinDeliveryRadius(5_000), true);
  assert.equal(isWithinDeliveryRadius(19_900), true);
  assert.equal(isWithinDeliveryRadius(20_000), true);
  assert.equal(isWithinDeliveryRadius(20_100), false);
});

async function withGeoapify(responseFor, run) {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GEOAPIFY_API_KEY;
  process.env.GEOAPIFY_API_KEY = "test-server-key";
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    return responseFor(url, init);
  };
  try { await run(); }
  finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEOAPIFY_API_KEY;
    else process.env.GEOAPIFY_API_KEY = previousKey;
  }
}

test("manual Finnish address resolution uses Geoapify and returns verified Finland details", async () => {
  await withGeoapify((url) => {
    assert.equal(url.pathname, "/v1/geocode/search");
    assert.equal(url.searchParams.get("text"), "Mannerheimintie 1, Helsinki");
    assert.equal(url.searchParams.get("filter"), null); // Country must be checked from the provider result.
    return Response.json({ results: [helsinki] });
  }, async () => {
    const result = await verifyAddressText("Mannerheimintie 1, Helsinki");
    assert.equal(result.countryCode, "FI");
    assert.equal(result.addressLine1, "Mannerheimintie 1");
    assert.equal(result.city, "Helsinki");
    assert.equal(result.postalCode, "00100");
    assert.equal(result.latitude, 60.1699);
  });
});

test("Finnish autocomplete requests are country restricted and include attribution metadata", async () => {
  await withGeoapify((url) => {
    assert.equal(url.pathname, "/v1/geocode/autocomplete");
    assert.equal(url.searchParams.get("filter"), "countrycode:fi");
    assert.equal(url.searchParams.get("countrycodes"), "fi");
    assert.equal(url.searchParams.get("apiKey"), "test-server-key");
    return Response.json({ results: [helsinki] });
  }, async () => {
    const results = await suggestFinnishAddresses("Mannerheimintie 1");
    assert.equal(results[0].location.countryCode, "FI");
    assert.match(results[0].text, /Helsinki/);
  });
});

test("Geoapify JSON autocomplete records with flat address fields display a complete label", async () => {
  await withGeoapify(() => Response.json({ results: [{ ...helsinki.properties }] }), async () => {
    const suggestions = await suggestFinnishAddresses("Mannerheimintie 1 Helsinki");
    assert.equal(suggestions[0].text, "Mannerheimintie 1, 00100 Helsinki, Finland");
    assert.equal(suggestions[0].location.addressLine1, "Mannerheimintie 1");
    assert.equal(suggestions[0].location.city, "Helsinki");
  });
});

test("autocomplete reads GeoJSON feature responses and normalizes Finland when the code is omitted", async () => {
  const feature = { type: "Feature", properties: { ...helsinki.properties, country_code: undefined, country: "Finland", lat: undefined, lon: undefined }, geometry: { type: "Point", coordinates: [24.9384, 60.1699] } };
  await withGeoapify(() => Response.json({ type: "FeatureCollection", features: [feature] }), async () => {
    const suggestions = await suggestFinnishAddresses("Mannerheimintie 1");
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].location.countryCode, "FI");
    assert.equal(suggestions[0].location.longitude, 24.9384);
  });
});

test("empty autocomplete response retries with Finland-filtered forward geocoding", async () => {
  let calls = 0;
  await withGeoapify((url) => {
    calls++;
    assert.equal(url.searchParams.get("filter"), "countrycode:fi");
    assert.equal(url.searchParams.get("countrycodes"), "fi");
    if (url.pathname.endsWith("/autocomplete")) return Response.json({ results: [] });
    assert.equal(url.pathname, "/v1/geocode/search");
    return Response.json({ results: [helsinki] });
  }, async () => {
    const suggestions = await suggestFinnishAddresses("Mannerheimintie 1 Helsinki");
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].location.countryCode, "FI");
    assert.equal(calls, 2);
  });
});

test("foreign addresses and reverse-geocoded GPS locations are rejected", async () => {
  const stockholm = { properties: { ...helsinki.properties, country: "Sweden", country_code: "se", city: "Haparanda", lat: 65.8355, lon: 24.1368 } };
  await withGeoapify(() => Response.json({ results: [stockholm] }), async () => {
    await assert.rejects(verifyAddressText("Haparanda, Sweden"), new RegExp(OUTSIDE_FINLAND_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await assert.rejects(verifyCoordinates(65.8355, 24.1368), /not available in this country/i);
  });
});

test("invalid coordinates and provider failures fail closed", async () => {
  await assert.rejects(verifyCoordinates(91, 0), /coordinates are invalid/i);
  await withGeoapify(() => new Response("forbidden", { status: 403 }), async () => {
    await assert.rejects(verifyAddressText("Helsinki, Finland"), /rejected the API key/i);
  });
  const old = process.env.GEOAPIFY_API_KEY;
  delete process.env.GEOAPIFY_API_KEY;
  try { assert.equal(getLocationConfiguration().geoapifyConfigured, false); await assert.rejects(verifyCoordinates(60, 25), /set GEOAPIFY_API_KEY/i); }
  finally { if (old !== undefined) process.env.GEOAPIFY_API_KEY = old; }
});

test("driving route threshold permits 5 km, 19.9 km and exactly 20 km, but rejects 20.1 km", async () => {
  const distances = [5_000, 19_900, 20_000, 20_100];
  let index = 0;
  await withGeoapify((url) => {
    assert.equal(url.pathname, "/v1/routing");
    assert.equal(url.searchParams.get("mode"), "drive");
    assert.equal(url.searchParams.get("units"), "metric");
    return Response.json({ results: [{ distance: distances[index++] }] });
  }, async () => {
    const origin = { latitude: 60.1699, longitude: 24.9384 };
    const points = [60.16, 60.161, 60.162, 60.163].map((latitude, i) => ({ latitude, longitude: 24.94 + i * 0.001 }));
    const outcomes = await Promise.all(points.map((point) => getKitchenDeliveryDistance(point, origin)));
    assert.deepEqual(outcomes.map((outcome) => outcome.eligible), [true, true, true, false]);
    assert.equal(outcomes[0].distanceKm, 5);
    assert.equal(outcomes[2].distanceKm, 20);
    assert.equal(outcomes[3].distanceKm, 20.1);
  });
});

test("failed routes are not converted into an assumed straight-line distance and successful routes are cached", async () => {
  const pointA = { latitude: 60.07731, longitude: 24.84726 };
  const pointB = { latitude: 60.08042, longitude: 24.86133 };
  let calls = 0;
  await withGeoapify(() => { calls++; return Response.json({ results: [{ distance: 12_345 }] }); }, async () => {
    assert.equal(await getDrivingDistanceMeters(pointA, pointB), 12_345);
    assert.equal(await getDrivingDistanceMeters(pointA, pointB), 12_345);
    assert.equal(calls, 1);
  });
  await withGeoapify(() => new Response("routing down", { status: 503 }), async () => {
    await assert.rejects(getDrivingDistanceMeters({ latitude: 60.1, longitude: 24.9 }, { latitude: 60.4, longitude: 25.1 }), new RegExp(ROUTING_UNAVAILABLE_MESSAGE));
  });
});

test("kitchen route matrix batches multiple exact kitchen-to-customer road distances and caches each pair", async () => {
  const customer = { latitude: 60.1699, longitude: 24.9384 };
  const kitchens = [
    { latitude: 60.1, longitude: 24.8 },
    { latitude: 60.2, longitude: 24.9 },
    { latitude: 60.3, longitude: 25.0 },
  ];
  let calls = 0;
  await withGeoapify((url, init) => {
    calls++;
    assert.equal(url.pathname, "/v1/routematrix");
    assert.equal(init.method, "POST");
    const body = JSON.parse(init.body);
    assert.equal(body.mode, "drive");
    assert.deepEqual(body.sources.map(({ location }) => location), [[24.8, 60.1], [24.9, 60.2], [25, 60.3]]);
    assert.deepEqual(body.targets, [{ location: [24.9384, 60.1699] }]);
    return Response.json({ sources_to_targets: [[{ distance: 19_900 }], [{ distance: 20_000 }], [{ distance: 20_100 }]] });
  }, async () => {
    const distances = await getKitchenDeliveryDistances(customer, kitchens);
    assert.deepEqual(distances, [19_900, 20_000, 20_100]);
    assert.deepEqual(distances.map((meters) => meters <= 20_000), [true, true, false]);
    assert.deepEqual(await getKitchenDeliveryDistances(customer, kitchens), distances);
    assert.equal(calls, 1);
  });
});

test("route matrix outages and unroutable kitchen pairs remain unavailable", async () => {
  const customer = { latitude: 60.41, longitude: 24.38 };
  const kitchen = { latitude: 60.51, longitude: 24.29 };
  await withGeoapify(() => new Response("routing down", { status: 503 }), async () => {
    await assert.rejects(getKitchenDeliveryDistances(customer, [kitchen]), new RegExp(ROUTING_UNAVAILABLE_MESSAGE));
  });
  await withGeoapify(() => Response.json({ sources_to_targets: [[{ distance: null, time: null }]] }), async () => {
    assert.deepEqual(await getKitchenDeliveryDistances(customer, [kitchen]), [null]);
  });
});

test("distance utility remains a pure estimate and returns zero for identical points", () => {
  const point = { latitude: 60.1699, longitude: 24.9384 };
  assert.equal(distanceKm(point, point), 0);
});
