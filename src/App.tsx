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
import { Expand, Shrink } from "lucide-react";

function App() {
  const [data, setData] = useState<any>(null);
  const [searchRadius, setSearchRadius] = useState<number>(5);
  const [fullScreen, setFullScreen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
        setError("Erreur lors de la recherche des villes");
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

  const bestPrice = (fuelType: string) => {
    if (!data || data.length === 0) return null;

    return (
      data.filter((el: any) => el[`${fuelType}_prix`])?.length > 0 &&
      data
        .filter((el: any) => el[`${fuelType}_prix`])
        .reduce((minPrice: any, current: any) =>
          current[`${fuelType}_prix`] < minPrice[`${fuelType}_prix`]
            ? current
            : minPrice
        )
    );
  };

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
      setError("Erreur lors de la récupération des villes proches");
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
      <header className="bg-slate-950 text-white px-10 pt-8">
        <h1 className="text-2xl">essenciel</h1>
      </header>

      <div className="flex flex-col justify-center items-center py-8 px-4 bg-slate-950">
        <div className="flex flex-col md:flex-row justify-center items-center gap-2 md:gap-4 mb-4">
          <button
            onClick={getLocalisation}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg shadow-md hover:bg-amber-600 transition"
          >
            Obtenir ma position
          </button>
          <p className="text-white">ou</p>
          <div className="flex flex-col relative">
            <input
              className="border border-white text-white px-4 py-2 rounded-lg"
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
        <div className="text-center">
          <label htmlFor="search-radius" className="text-white">
            Trouver un distributeur dans un rayon de
          </label>
          <select
            name="search-radius"
            id="ssearch-radius"
            className="text-white"
            onChange={(e) => rayonChange(e)}
          >
            <option className="text-black" value={5}>
              5km
            </option>
            <option className="text-black" value={10}>
              10km
            </option>
            <option className="text-black" value={15}>
              15km
            </option>
          </select>
        </div>
      </div>

      {error && (
        <div className="fixed top-px right-px p-4 size-fit rounded-lg bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError(null)}>Fermer</button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row bg-stone-100">
        {cityLocation.name && (
          <div className="flex flex-col gap-4 w-full lg:w-1/2 p-4 lg:p-10">
            <div>
              <h2 className="text-xl mb-2">Votre commune :</h2>
              <p>
                {cityLocation.name} - {cityLocation.cp}
              </p>
            </div>
            {data && (
              <div className="w-full">
                <h2 className="text-xl mb-2">Les meilleurs prix :</h2>
                <table className="w-full md:w-fit">
                  <tbody className="text-sm">
                    {types.map(
                      (el: { type: string; name: string }, index: number) => {
                        return (
                          <tr key={index}>
                            <th className="border border-stone-200 font-medium px-2.5 py-2 text-start">
                              {el.name}
                            </th>
                            <td className="border border-stone-200 px-2.5 py-2 text-start">
                              {bestPrice(el.type)
                                ? `${bestPrice(el.type).adresse}, ${
                                    bestPrice(el.type)?.cp ?? null
                                  } ${bestPrice(el.type)?.ville ?? null} (${
                                    bestPrice(el.type)?.[`${el.type}_prix`]
                                  })`
                                : "Pas distribué dans cette zone"}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {cityLocation.latitude && cityLocation.longitude && (
          <div className="w-full lg:w-1/2 relative">
            <div className="absolute z-[2] top-4 right-4">
              <button
                className="cursor-pointer"
                onClick={() => setFullScreen(true)}
              >
                <Expand />
              </button>
            </div>

            <div className="h-full">
              <MapContainer
                className="w-full h-full min-h-[30rem] z-[1]"
                center={[cityLocation.latitude, cityLocation.longitude]}
                zoom={12}
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
                          {types.map(
                            (
                              element: { type: string; name: string },
                              index: number
                            ) => {
                              const rupture = element.type + "_rupture_type";
                              const prix = element.type + "_prix";

                              return (
                                el?.[rupture] !== "definitive" && (
                                  <li key={index}>
                                    {element.name} : {el?.[prix] ?? "rupture"}
                                  </li>
                                )
                              );
                            }
                          )}
                        </ul>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </div>
          </div>
        )}
      </div>

      {cityLocation.latitude && cityLocation.longitude && fullScreen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2,
          }}
        >
          <button
            className="fixed z-[3] top-4 right-4 cursor-pointer"
            onClick={() => setFullScreen(false)}
          >
            <Shrink />
          </button>
          <MapContainer
            center={[cityLocation.latitude, cityLocation.longitude]}
            zoom={12}
            style={{
              width: "100%",
              height: "100vh",
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
                      {types.map(
                        (
                          element: { type: string; name: string },
                          index: number
                        ) => {
                          const rupture = element.type + "_rupture_type";
                          const prix = element.type + "_prix";

                          return (
                            el?.[rupture] !== "definitive" && (
                              <li key={index}>
                                {element.name} : {el?.[prix] ?? "rupture"}
                              </li>
                            )
                          );
                        }
                      )}
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
