"use client";

import { useState } from "react";
import { ProfileEditor } from "@/components/ProfileSettings";
import { useCurrentUser } from "@/components/UserContext";
import { StatusBadge } from "@/components/StatusBadge";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { Notice } from "@/components/UI";

export default function ProfilePage() {
  const user = useCurrentUser();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="profile-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR ACCOUNT</span>
          <h1 className="mt-2">My profile</h1>
          <p>View your details or update them before your next journey.</p>
        </div>
      </div>
      <Notice message={saved ? "Your profile was saved." : ""} />
      <section
        className="panel profile-panel profile-overview"
        aria-label="Profile overview"
      >
        <div className="profile-overview-header">
          <Avatar name={user.name} photo={user.profile_photo} large />
          <div className="profile-overview-identity">
            <h2>{user.name}</h2>
            <div className="profile-overview-badges">
              <span className="profile-account-role">{user.role} account</span>
              <StatusBadge status={user.status} />
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary profile-edit-button"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            <Icon name="edit" size={16} />
            Edit profile
          </button>
        </div>
        <div className="profile-overview-section">
          <h3>Personal details</h3>
          <dl className="profile-details-grid">
            <div>
              <dt>
                <Icon name="mail" size={16} />
                Email address
              </dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>
                <Icon name="phone" size={16} />
                Phone number
              </dt>
              <dd>
                {user.phone_number ? (
                  <a href={`tel:${user.phone_number}`}>{user.phone_number}</a>
                ) : (
                  <span className="muted">Not added</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
        {user.role === "driver" ? (
          <div className="profile-overview-section">
            <h3>
              <Icon name="car" size={18} />
              Car details
            </h3>
            <dl className="profile-details-grid profile-vehicle-grid">
              <div>
                <dt>Car colour</dt>
                <dd>
                  {user.car_colour || <span className="muted">Not added</span>}
                </dd>
              </div>
              <div>
                <dt>Model / type</dt>
                <dd>
                  {user.car_type || <span className="muted">Not added</span>}
                </dd>
              </div>
              <div>
                <dt>Plate number</dt>
                <dd className="profile-plate-number">
                  {user.car_plate || <span className="muted">Not added</span>}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </section>
      {editing ? (
        <ProfileEditor
          user={user}
          onClose={() => setEditing(false)}
          onSaved={() => setSaved(true)}
        />
      ) : null}
    </div>
  );
}
