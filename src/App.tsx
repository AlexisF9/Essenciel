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

  const [cityLocation, setCityLocation] = useState<{
    latitude: number | null;
    longitude: number | null;
    name: string | null;
    cp: string | null;
  }>({
    latitude: null,
    longitude: null,
    name: null,
    cp: null,
  });

  const [inputCity, setInputCity] = useState<string>("");
  const [searchCity, setSearchCity] = useState([]);

  const types = [
    {
      type: "gazole",
      name: "Gazole",
    },
    {
      type: "sp95",
      name: "SP95",
    },
    {
      type: "sp98",
      name: "SP98",
    },
    {
      type: "e10",
      name: "E10",
    },
    {
      type: "e85",
      name: "E85",
    },
    {
      type: "gplc",
      name: "GPLc",
    },
  ];

  useEffect(() => {
    findCity(inputCity);
  }, [inputCity]);

  const findCity = async (name: string) => {
    const url = `https://geo.api.gouv.fr/communes?nom=${name}`;
    if (name.replace(/[^a-zA-Z]/g, "").length > 3) {
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (data) {
          setSearchCity(data);
        }
      } catch (error) {
        console.error("Erreur lors de la recherche des villes :", error);
      }
    }
  };

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
            cityLocation.latitude !== position.coords.latitude &&
            cityLocation.longitude !== position.coords.longitude
          ) {
            setCityLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              name: null,
              cp: null,
            });
            fetchCity(position.coords.latitude, position.coords.longitude);
          }
        },
        (error) => {
          console.log(error.message);
        }
      );
    } else {
      console.log(
        "La géolocalisation n'est pas supportée par votre navigateur."
      );
    }
  };

  useEffect(() => {
    getLocalisation();
  }, []);

  //const bestPrice =
  //  data?.length > 0
  //    ? data
  //        ?.filter((el: { gazole_prix: number }) => el.gazole_prix)
  //        .reduce(
  //          (
  //            minGazolePrice: { gazole_prix: number },
  //            currentGazolePrice: { gazole_prix: number }
  //          ) => {
  //            return currentGazolePrice.gazole_prix < minGazolePrice.gazole_prix
  //              ? currentGazolePrice
  //              : minGazolePrice;
  //          }
  //        )
  //    : null;

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
    if (cityLocation.latitude && cityLocation.longitude) {
      fetchCity(cityLocation.latitude, cityLocation.longitude);
    }
  }, [searchRadius]);

  const fetchCity = async (latitude: number, longitude: number) => {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data) {
        setCityLocation({
          name: data.name,
          cp: data.address.postcode,
          latitude: latitude,
          longitude: longitude,
        });
        fetchNearbyCities(latitude, longitude);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des villes proches", error);
    }
  };

  const fetchNearbyCities = async (
    lat: string | number,
    lon: string | number
  ) => {
    const username = import.meta.env.VITE_GEONAMES_USERNAME;
    const url = `https://secure.geonames.org/findNearbyPostalCodesJSON?lat=${lat}&lng=${lon}&formatted=true&country=FR&radius=${searchRadius}&username=${username}&style=full&maxRows=100`;

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

  const fetchList = (cities: { placeName: string; adminName2: string }[]) => {
    if (cities?.length > 0) {
      const apiUrl =
        "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records";

      const whereClauses = cities.map(
        (el: { placeName: string }) => `(ville="${el.placeName}")`
      );
      const whereQuery = whereClauses.join("OR");
      const url = `${apiUrl}?where=${encodeURIComponent(
        whereQuery
      )}&limit=100&offset=0`;

      const departments = cities.reduce(
        (acc: any, item: { adminName2: string }) => {
          if (!acc.includes(item.adminName2)) {
            acc.push(item.adminName2);
          }
          return acc;
        },
        []
      );

      fetch(url)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Erreur lors de la récupération des données");
          }
          return response.json();
        })
        .then((data) => {
          const filteredData = data?.results.filter(
            (res: { departement: string }) =>
              departments.find((dep: string) => dep === res.departement)
          );
          setData(filteredData);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  const getCoordsCity = async (name: string, cp: string) => {
    setSearchCity([]);
    setInputCity("");

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${name}%20${cp}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data) {
        setCityLocation({
          name: name,
          cp: cp,
          latitude: data[0]?.lat,
          longitude: data[0]?.lon,
        });
        fetchNearbyCities(data[0]?.lat, data[0]?.lon);
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des villes proches", error);
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
          <p>ou</p>
          <div className="flex flex-col relative">
            <input
              className="border border-black px-4 py-2 rounded-lg"
              type="text"
              name="city"
              id="city"
              value={inputCity}
              placeholder="Votre commune"
              onChange={(e) => setInputCity(e.target.value)}
            />
            {searchCity?.length > 0 && (
              <div className="absolute top-full bg-neutral-800 w-full text-white p-4 rounded-lg z-9">
                <ul className="flex flex-col gap-2">
                  {searchCity
                    .slice(0, 10)
                    .map(
                      (
                        el: { nom: string; codesPostaux: string[] },
                        index: number
                      ) => (
                        <li key={index}>
                          <button
                            className="text-start cursor-pointer"
                            onClick={() =>
                              getCoordsCity(el.nom, el.codesPostaux[0])
                            }
                          >
                            {el.nom} ({el.codesPostaux[0]})
                          </button>
                        </li>
                      )
                    )}
                </ul>
              </div>
            )}
          </div>
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
            <option value={15}>15km</option>
          </select>
        </div>
      </div>

      {cityLocation.name && (
        <div className="py-10 px-4 flex flex-col gap-4">
          <div>
            <h2 className="text-xl mb-2">Votre commune :</h2>
            <p>
              {cityLocation.name} - {cityLocation.cp}
            </p>
          </div>
        </div>
      )}

      {cityLocation.latitude && cityLocation.longitude && (
        <div className="contents">
          <MapContainer
            center={[cityLocation.latitude, cityLocation.longitude]}
            zoom={12}
            style={{
              width: "100%",
              height: "100%",
              flexGrow: 1,
              minHeight: "30rem",
              zIndex: 1,
            }}
          >
            <TileLayer
              url="https://tile.thunderforest.com/atlas/{z}/{x}/{y}.png?apikey=58c26f71f4664526a0753cd77a570191"
              attribution='Maps &copy; <a href="https://www.thunderforest.com/">Thunderforest</a>, Data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            <SetViewOnClick
              coords={
                [
                  cityLocation.latitude,
                  cityLocation.longitude,
                ] as LatLngExpression
              }
            />
            {cityLocation.latitude && cityLocation.longitude ? (
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
                  position={[cityLocation.latitude, cityLocation.longitude]}
                >
                  <Popup>Votre position</Popup>
                </Marker>
              </LayerGroup>
            ) : (
              <></>
            )}
            {data &&
              data?.map((el: any, index: number) => (
                <Marker
                  key={index + 1}
                  position={[el.geom.lat, el.geom.lon]}
                  icon={customIcon}
                >
                  <Popup>
                    <p className="font-semibold">
                      {el.adresse} - {el.ville}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {types.map((element: { type: string; name: string }) => {
                        const rupture = element.type + "_rupture_type";
                        const prix = element.type + "_prix";

                        return (
                          el?.[rupture] !== "definitive" && (
                            <li>
                              {element.name} : {el?.[prix] ?? "rupture"}
                            </li>
                          )
                        );
                      })}
                    </ul>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}

export default App;
