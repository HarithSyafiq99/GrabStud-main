"use client";

import { useId, useRef, useState } from "react";
import { ActionButton } from "./ActionButton";
import { Icon } from "./Icon";

export function FareOfferForm({
  passengerName,
  passengerCount,
  suggestedPrice,
  disabled,
  pending,
  success,
  onOffer,
}: {
  passengerName: string;
  passengerCount: number;
  suggestedPrice: number | null;
  disabled: boolean;
  pending: boolean;
  success: boolean;
  onOffer: (price: number) => void;
}) {
  const [price, setPrice] = useState("");
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const amount = Number(price);
  const valid =
    /^\d+(\.\d{1,2})?$/.test(price) && amount > 0 && amount <= 99999.99;
  const invalid = touched && price !== "" && !valid;
  const usesSuggestion = valid && amount === suggestedPrice;

  return (
    <form
      className="fare-offer"
      data-ready={valid}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || disabled || pending || success) return;
        onOffer(amount);
      }}
    >
      <div className="fare-offer-heading">
        <span className="fare-offer-step" aria-hidden="true">
          {valid ? <Icon name="check" size={16} /> : "1"}
        </span>
        <div>
          <h4>Set your fare</h4>
          <p>
            {suggestedPrice == null
              ? "Review the passenger’s map pins and enter your price."
              : "Choose the suggestion or enter your own price."}
          </p>
        </div>
      </div>
      {suggestedPrice != null ? (
        <button
          className="fare-suggestion"
          type="button"
          disabled={disabled || pending || success}
          aria-pressed={usesSuggestion}
          onClick={() => {
            setPrice(suggestedPrice.toFixed(2));
            setTouched(false);
            inputRef.current?.focus();
          }}
        >
          <Icon name={usesSuggestion ? "check" : "wallet"} size={16} />
          Use suggested <strong>RM {suggestedPrice.toFixed(2)}</strong>
          <Icon name="arrow" size={15} />
        </button>
      ) : null}
      <label className="field" htmlFor={id}>
        Total fare for {passengerCount}{" "}
        {passengerCount === 1 ? "passenger" : "passengers"}
      </label>
      <div className="fare-input-wrap">
        <span aria-hidden="true">RM</span>
        <input
          ref={inputRef}
          id={id}
          className="input fare-input"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          required
          pattern="[0-9]+(\.[0-9]{1,2})?"
          maxLength={8}
          disabled={disabled || pending || success}
          aria-label={"Your fare for " + passengerName}
          aria-describedby={id + "-help"}
          aria-invalid={invalid}
          placeholder="Enter your fare"
          value={price}
          onChange={(event) => setPrice(event.target.value.replace(",", "."))}
          onBlur={() => {
            setTouched(true);
            if (valid) setPrice(amount.toFixed(2));
          }}
        />
        {valid ? (
          <Icon name="check" size={18} className="fare-input-check" />
        ) : null}
      </div>
      <p
        className="fare-help"
        id={id + "-help"}
        data-error={invalid}
        role="status"
        aria-live="polite"
      >
        {invalid
          ? "Enter RM 0.01–99,999.99 with up to 2 decimal places."
          : valid
            ? `Ready to send RM ${amount.toFixed(2)}. The passenger agrees before booking.`
            : "Enter a fare above to enable your price offer."}
      </p>
      <ActionButton
        loadingLabel="Sending price…"
        successLabel="Price sent!"
        pending={pending}
        success={success}
        disabled={disabled || !valid}
        type="submit"
      >
        Choose passenger & send price
      </ActionButton>
    </form>
  );
}
