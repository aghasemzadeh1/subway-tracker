const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const app = express();
app.use(cors());

const FEEDS = [
  'gtfs',           // 1 2 3 4 5 6 7
  'gtfs-ace',       // A C E
  'gtfs-bdfm',      // B D F M
  'gtfs-g',         // G
  'gtfs-jz',        // J Z
  'gtfs-l',         // L
  'gtfs-nqrw',      // N Q R W
  'gtfs-si',        // Staten Island
];

const BASE_URL = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct/';

app.get('/api/trains', async (req, res) => {
  try {
    const results = await Promise.all(
      FEEDS.map(feed =>
        fetch(`${BASE_URL}${feed}`)
          .then(r => r.arrayBuffer())
          .then(buf => {
            const msg = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
              new Uint8Array(buf)
            );
            return msg.entity;
          })
          .catch(e => {
            console.error(`Failed to fetch ${feed}:`, e.message);
            return [];
          })
      )
    );

    const entities = results.flat();

    // Extract trip updates with stop time info
    const trains = entities
      .filter(e => e.tripUpdate)
      .map(e => ({
        tripId: e.id,
        line: e.tripUpdate.trip?.routeId || '?',
        direction: e.tripUpdate.trip?.nyctTripDescriptor?.direction,
        stopTimeUpdates: (e.tripUpdate.stopTimeUpdate || []).map(s => ({
          stopId: s.stopId,
          arrival: s.arrival?.time?.low || null,
          departure: s.departure?.time?.low || null,
        })),
      }))
      .filter(t => t.stopTimeUpdates.length > 0);

    res.json({ trains, timestamp: Date.now() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Server running on http://localhost:3001'));