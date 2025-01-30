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
  const [searchRadius, setSearchRadius] = useState<number>(5);
  const [location, setLocation] = useState<{
    active: boolean;
    latitude: number;
    longitude: number;
    name: string;
    error: string | null;
  }>({
    name: "Paris",
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
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (
            location.latitude !== position.coords.latitude &&
            location.longitude !== position.coords.longitude
          ) {
            setLocation({
              active: true,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              name: "",
              error: null,
            });
            fetchCity(position.coords.latitude, position.coords.longitude);
          }
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
        setLocation((prev) => {
          return {
            ...prev,
            name: data.name,
          };
        });
        setCityLocation({ latitude: data?.lat, longitude: data?.lon });
        fetchNearbyCities(data?.address?.postcode);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des villes proches", error);
    }
  };

  const fetchNearbyCities = async (cp: string) => {
    const username = import.meta.env.VITE_GEONAMES_USERNAME;
    const url = `https://secure.geonames.org/findNearbyPostalCodesJSON?formatted=true&postalcode=${cp}&country=FR&radius=${searchRadius}&username=${username}&style=full&maxRows=100`;

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
    <div className="min-h-screen flex flex-col">
      <header className="bg-neutral-800 text-white p-10">
        <h1 className="text-2xl">Essenciel</h1>
      </header>

      <div className="flex flex-col justify-center items-center bg-stone-100 py-10 px-4">
        <div className="flex flex-col md:flex-row justify-center items-center gap-2 md:gap-4 mb-4">
          <button
            onClick={getLocalisation}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition"
          >
            Obtenir ma position
          </button>
          {/*<p>ou</p>
          <div className="flex flex-col">
            <input
              className="border border-black px-4 py-2 rounded-lg"
              type="text"
              name="city"
              id="city"
              placeholder="Votre commune"
            />
          </div> */}
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
      </div>

      <div className="py-10 px-4 flex flex-col gap-4">
        {location.active && (
          <div>
            <h2 className="text-xl mb-2">Votre commune :</h2>
            <p>{location.name}</p>
          </div>
        )}
        {bestPrice && (
          <div>
            <h2 className="text-xl mb-2">
              Le meilleur prix autour de vous est :
            </h2>
            <p>
              {bestPrice.adresse} - {bestPrice.ville} {bestPrice.gazole_prix}
            </p>
          </div>
        )}
      </div>

      <div className="contents">
        <MapContainer
          center={[location.latitude, location.longitude]}
          zoom={12}
          style={{
            width: "100%",
            height: "100%",
            flexGrow: 1,
            minHeight: "30rem",
          }}
        >
          <TileLayer
            url="https://tile.thunderforest.com/atlas/{z}/{x}/{y}.png?apikey=58c26f71f4664526a0753cd77a570191"
            attribution='Maps &copy; <a href="https://www.thunderforest.com/">Thunderforest</a>, Data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

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
    </div>
  );
}

export default App;
