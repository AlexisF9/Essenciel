import { useEffect, useState } from "react";
import {
  Circle,
  LayerGroup,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "./App.css";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LatLngExpression } from "leaflet";
import customMarkerIcon from "/pin.png";
import customMeIcon from "/me.png";

function App() {
  const [data, setData] = useState<any>(null);
  const [mapStyle, setMapStyle] = useState<string>("normal");
  const [searchRadius, setSearchRadius] = useState<number>(5);
  const [location, setLocation] = useState<{
    active: boolean;
    latitude: number;
    longitude: number;
    error: string | null;
  }>({
    active: false,
    latitude: 48.864716,
    longitude: 2.349014,
    error: null,
  });

  const [cityLocation, setCityLocation] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({
    latitude: null,
    longitude: null,
  });

  //https://data.economie.gouv.fr/explore/dataset/prix-des-carburants-en-france-flux-instantane-v2/api/
  //https://www.openstreetmap.org/#map=12/45.1426/5.7349
  //https://nominatim.openstreetmap.org/reverse?format=json&lat=45.185567253516&lon=5.75784886983
  //https://www.geonames.org/export/ws-overview.html

  const customIcon = new L.Icon({
    iconUrl: customMarkerIcon,
    iconSize: [32, 32],
    iconAnchor: [16, 32], // Ancrage de l'icône
    popupAnchor: [0, -32], // Position du popup par rapport à l'icône
  });
  const customPersonIcon = new L.Icon({
    iconUrl: customMeIcon,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });

  const getLocalisation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            active: true,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            error: null,
          });
          fetchCity(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          setLocation((prevState) => ({
            ...prevState,
            active: false,
            error: error.message,
          }));
        }
      );
    } else {
      setLocation((prevState) => ({
        ...prevState,
        active: false,
        error: "La géolocalisation n'est pas supportée par votre navigateur.",
      }));
    }
  };

  useEffect(() => {
    getLocalisation();
  }, []);

  const bestPrice =
    data?.results?.length > 0
      ? data?.results
          ?.filter((el: { gazole_prix: number }) => el.gazole_prix)
          .reduce(
            (
              minGazolePrice: { gazole_prix: number },
              currentGazolePrice: { gazole_prix: number }
            ) => {
              return currentGazolePrice.gazole_prix < minGazolePrice.gazole_prix
                ? currentGazolePrice
                : minGazolePrice;
            }
          )
      : null;

  const SetViewOnClick = ({ coords }: { coords: LatLngExpression }) => {
    const map = useMap();
    map.setView(coords, map.getZoom());
    return null;
  };

  const styleMapChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setMapStyle(e.target.value);
  };

  const rayonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.preventDefault();
    setSearchRadius(parseInt(e.target.value));
  };

  useEffect(() => {
    if (location.active) {
      fetchCity(location.latitude, location.longitude);
    }
  }, [searchRadius]);

  const fetchCity = async (latitude: number, longitude: number) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data) {
        setCityLocation({ latitude: data?.lat, longitude: data?.lon });
        fetchNearbyCities(data?.address?.postcode);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des villes proches", error);
    }
  };

  const fetchNearbyCities = async (cp: string) => {
    const username = import.meta.env.VITE_GEONAMES_USERNAME;
    const url = `https://api.geonames.org/findNearbyPostalCodesJSON?formatted=true&postalcode=${cp}&country=FR&radius=${searchRadius}&username=${username}&style=full&maxRows=100`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data?.postalCodes) {
        fetchList(data.postalCodes);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des villes proches", error);
    }
  };

  const fetchList = (cities: { placeName: string; postalCode: string }[]) => {
    if (cities?.length > 0) {
      const apiUrl =
        "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records";

      const whereClauses = cities.map(
        (el) => `(ville="${el.placeName}" AND cp="${el.postalCode}")`
      );
      const whereQuery = whereClauses.join("OR");
      const url = `${apiUrl}?where=${encodeURIComponent(
        whereQuery
      )}&limit=100&offset=0`;

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Erreur lors de la récupération des données");
          }
          return response.json();
        })
        .then((data) => {
          setData(data);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  return (
    <>
      <div>
        <label htmlFor="tile-style">Changer le style de la map</label>
        <select
          name="map-style"
          id="tile-style"
          onChange={(e) => styleMapChange(e)}
        >
          <option value="normal">Normal</option>
          <option value="light">Clair</option>
          <option value="dark">Sombre</option>
        </select>
      </div>
      <div>
        <label htmlFor="search-radius">
          Trouver un distributeur dans un rayon de
        </label>
        <select
          name="search-radius"
          id="ssearch-radius"
          onChange={(e) => rayonChange(e)}
        >
          <option value={5}>5km</option>
          <option value={10}>10km</option>
          <option value={20}>20km</option>
        </select>
      </div>

      {bestPrice && (
        <p>
          {bestPrice.adresse} - {bestPrice.ville} {bestPrice.gazole_prix}
        </p>
      )}

      <div className="h-[50rem]">
        <MapContainer
          center={[location.latitude, location.longitude]}
          zoom={12}
          style={{ width: "100%", height: "100%" }}
        >
          {mapStyle === "light" ? (
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            />
          ) : mapStyle === "dark" ? (
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
            />
          ) : (
            <TileLayer
              url="https://tile.thunderforest.com/atlas/{z}/{x}/{y}.png?apikey=58c26f71f4664526a0753cd77a570191"
              attribution='Maps &copy; <a href="https://www.thunderforest.com/">Thunderforest</a>, Data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
          )}

          <SetViewOnClick
            coords={[location.latitude, location.longitude] as LatLngExpression}
          />
          {location.active &&
            cityLocation.latitude &&
            cityLocation.longitude && (
              <LayerGroup>
                <Circle
                  center={[cityLocation.latitude, cityLocation.longitude]}
                  fillColor="blue"
                  fillOpacity={0.1}
                  radius={searchRadius * 1000}
                />
                <Marker
                  icon={customPersonIcon}
                  key={0}
                  position={[location.latitude, location.longitude]}
                >
                  <Popup>Votre position</Popup>
                </Marker>
              </LayerGroup>
            )}
          {data &&
            data?.results?.map((el: any, index: number) => (
              <Marker
                key={index + 1}
                position={[el.geom.lat, el.geom.lon]}
                icon={customIcon}
              >
                <Popup>
                  {el.adresse} - {el.ville} ({el.gazole_prix})
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </div>
    </>
  );
}

export default App;
