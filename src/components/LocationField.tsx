"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  parseLocationPin,
  validLocationName,
  type LocationPin,
} from "@/lib/locations";
import type { AddressLocation, LocationLookup } from "@/lib/geocoding";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { LocationMap } from "./LocationMap";
import { LoadingEmblem } from "./LoadingOverlay";
import { Notice } from "./UI";

export function LocationField({
  kind,
  name,
  pin,
  onNameChange,
  onPinChange,
  nearby,
}: {
  kind: "pickup" | "destination";
  name: string;
  pin: LocationPin | null;
  onNameChange: (name: string) => void;
  onPinChange: (pin: LocationPin | null) => void;
  nearby?: LocationPin | null;
}) {
  const id = useId(),
    title = kind === "pickup" ? "Pickup" : "Destination";
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<LocationPin | null>(pin);
  const [draftAddress, setDraftAddress] = useState(""),
    [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  const [results, setResults] = useState<AddressLocation[]>([]);
  const getCentre = useRef<(() => LocationPin) | null>(null);
  const [centreReady, setCentreReady] = useState(false);
  const request = useRef(0),
    controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      request.current++;
      controller.current?.abort();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  function stop() {
    request.current++;
    controller.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setBusy("");
  }
  function close() {
    stop();
    setOpen(false);
    setError("");
  }
  async function lookup(input: LocationLookup, current: number) {
    const abort = new AbortController();
    controller.current = abort;
    const response = await fetch("/api/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        input.action === "reverse"
          ? { action: "reverse", ...input.pin }
          : input,
      ),
      signal: abort.signal,
    });
    const data = await response.json();
    if (current !== request.current) return null;
    if (!response.ok)
      throw new Error(data.error ?? "Address lookup failed. Please try again.");
    return data.locations as AddressLocation[];
  }
  function commit(location: AddressLocation) {
    stop();
    onNameChange(location.address);
    onPinChange({ lat: location.lat, lng: location.lng });
    setResults([]);
    setError("");
  }
  async function search() {
    if (!validLocationName(name) || busy) return;
    stop();
    const current = request.current;
    setBusy("Finding your address…");
    setError("");
    setResults([]);
    try {
      const locations = await lookup(
        { action: "search", query: name.trim(), nearby: pin ?? nearby },
        current,
      );
      if (!locations || current !== request.current) return;
      if (locations.length === 1) commit(locations[0]);
      else if (locations.length) setResults(locations);
      else
        setError(
          "No matching address found. Add the town or street, or mark the map to choose your location.",
        );
    } catch (e) {
      if (current === request.current) setError((e as Error).message);
    } finally {
      if (current === request.current) setBusy("");
    }
  }
  function selectPoint(point: LocationPin) {
    stop();
    const current = request.current;
    try {
      const selected = parseLocationPin(point.lat, point.lng);
      if (!selected) return;
      point = selected;
    } catch {
      setError("Choose a valid point on the map.");
      return;
    }
    setDraft(point);
    setDraftAddress("");
    setManual(false);
    setError("");
    setBusy("Finding the address for your pin…");
    // Wait until a tap or drag settles; superseded requests never update the field.
    timer.current = setTimeout(async () => {
      try {
        const locations = await lookup(
          { action: "reverse", pin: point },
          current,
        );
        if (!locations || current !== request.current) return;
        if (locations[0]) setDraftAddress(locations[0].address);
        else {
          setManual(true);
          setError(
            "No street address is mapped here. Enter the address for this pin below.",
          );
        }
      } catch (e) {
        if (current === request.current) {
          setManual(true);
          setError((e as Error).message);
        }
      } finally {
        if (current === request.current) setBusy("");
      }
    }, 900);
  }
  function locate() {
    if (busy) return;
    if (!navigator.geolocation) {
      setError(
        "Location is unavailable in this browser. Mark the map instead.",
      );
      return;
    }
    stop();
    const current = request.current;
    setBusy("Finding your current location…");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (current !== request.current) return;
        try {
          const point = parseLocationPin(
            position.coords.latitude,
            position.coords.longitude,
          );
          if (point) selectPoint(point);
        } catch {
          setBusy("");
          setError(
            "Your location could not be read. Please mark the map instead.",
          );
        }
      },
      (problem) => {
        if (current !== request.current) return;
        setBusy("");
        setError(
          problem.code === 1
            ? "Location permission was denied. You can still tap the map to choose your location."
            : "Your current location could not be found. Please tap the map or try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }
  const progress = busy ? (
    <div className="location-address-loading" role="status">
      <LoadingEmblem />
      <span>{busy}</span>
    </div>
  ) : null;
  return (
    <div className="location-field">
      <label className="field" htmlFor={id}>
        {title.toUpperCase()} LOCATION
        <input
          id={id}
          className="input"
          value={name}
          required
          minLength={2}
          maxLength={160}
          placeholder={
            kind === "pickup"
              ? "Enter your pickup address"
              : "Enter your destination address"
          }
          autoComplete="off"
          aria-describedby={`${id}-help`}
          onChange={(e) => {
            stop();
            onNameChange(e.target.value);
            onPinChange(null);
            setResults([]);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
        />
      </label>
      <div className="location-address-tools">
        <small id={`${id}-help`} role="status" aria-live="polite">
          {pin
            ? "Address linked to your map pin."
            : "Enter a place or address, then tap Find on map."}
        </small>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!validLocationName(name) || !!busy}
          onClick={() => void search()}
        >
          <Icon name="pin" size={15} />
          Find on map
        </button>
      </div>
      {results.length ? (
        <div
          className="location-address-results"
          role="group"
          aria-label={`${title} address matches`}
        >
          <p>Choose your address to set the pin:</p>
          {results.map((result, i) => (
            <button
              type="button"
              key={`${result.lat}:${result.lng}:${i}`}
              onClick={() => commit(result)}
            >
              <Icon name="pin" size={16} />
              <span>{result.address}</span>
              <Icon name="chevron" size={14} />
            </button>
          ))}
          <small>Search by OpenStreetMap data · Photon</small>
        </div>
      ) : null}
      {!open ? (
        <>
          {progress}
          <Notice message={error} error />
        </>
      ) : null}
      <button
        type="button"
        className={`location-pin-button ${pin ? "is-marked" : ""}`}
        onClick={() => {
          stop();
          setResults([]);
          setDraft(pin);
          setDraftAddress(pin ? name : "");
          setManual(false);
          setError("");
          setOpen(true);
        }}
      >
        <Icon name={pin ? "check" : "pin"} size={19} />
        <span>
          <strong>{pin ? `${title} pin saved` : `Mark ${kind} on map`}</strong>
          <small>
            {pin
              ? "View or adjust your address and pin"
              : "Tap a point to fill in its address"}
          </small>
        </span>
        <Icon name="chevron" size={16} />
      </button>
      {pin ? (
        <button
          type="button"
          className="location-remove"
          onClick={() => {
            stop();
            onPinChange(null);
          }}
        >
          Remove pin
        </button>
      ) : null}
      <Modal
        open={open}
        title={`Mark your ${kind} location`}
        className="location-modal"
        onClose={close}
      >
        <p className="location-map-instructions">
          Tap the map or drag the pin. The {kind} address updates to match the
          selected point.
        </p>
        {open ? (
          <LocationMap
            value={draft}
            selectionKind={kind}
            points={
              !draft && nearby
                ? [{ ...nearby, kind: "pickup", label: "Your pickup" }]
                : []
            }
            onSelect={selectPoint}
            onCentre={(fn) => {
              getCentre.current = fn;
              setCentreReady(!!fn);
            }}
          />
        ) : null}
        <div className="location-map-tools">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!!busy}
            onClick={locate}
          >
            <Icon name="pin" size={16} />
            Use my current location
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!centreReady}
            onClick={() => {
              const point = getCentre.current?.();
              if (point) selectPoint(point);
            }}
          >
            Place pin at centre
          </button>
        </div>
        {progress}
        <div className="location-selected-address" aria-live="polite">
          <strong>{title} address</strong>
          {manual ? (
            <label className="field" htmlFor={`${id}-manual`}>
              Address for this pin
              <input
                id={`${id}-manual`}
                className="input"
                value={draftAddress}
                minLength={2}
                maxLength={160}
                placeholder="Enter this point’s address"
                onChange={(e) => setDraftAddress(e.target.value)}
              />
            </label>
          ) : (
            <p>
              {draftAddress ||
                (busy
                  ? "Looking up the address…"
                  : "Choose a point on the map.")}
            </p>
          )}
          {draft ? (
            <small>
              {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)} · OpenStreetMap /
              Photon
            </small>
          ) : null}
        </div>
        <Notice message={error} error />
        {manual && draft ? (
          <button
            type="button"
            className="location-remove"
            onClick={() => selectPoint(draft)}
          >
            Retry address lookup
          </button>
        ) : null}
        <div className="action-group mt-4">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!draft || !!busy || !validLocationName(draftAddress)}
            onClick={() => {
              if (!draft) return;
              commit({ ...draft, address: draftAddress.trim() });
              close();
            }}
          >
            <Icon name="check" size={16} />
            Save {kind} location
          </button>
          <button type="button" className="btn btn-secondary" onClick={close}>
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
