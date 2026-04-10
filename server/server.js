const express = require('express');
const cors = require('cors');
const path = require('path');
const GtfsRealtimeBindings = require('gtfs-realtime-bindings');

const app = express();
app.use(cors());

const FEEDS = [
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',
];

app.get('/api/trains', async (req, res) => {
  try {
    const results = await Promise.all(
      FEEDS.map(url =>
        fetch(url)
          .then(r => {
            console.log(`${url} → status ${r.status}`);
            return r.arrayBuffer();
          })
          .then(buf => {
            const msg = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
              new Uint8Array(buf)
            );
            console.log(`  → ${msg.entity.length} entities`);
            return msg.entity;
          })
          .catch(e => {
            console.error(`Failed: ${e.message}`);
            return [];
          })
      )
    );

    const entities = results.flat();

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

// Serve built React app in production
const clientBuild = path.join(__dirname, '../client/build');
app.use(express.static(clientBuild));
app.get('/{*path}', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));