import React from 'react';
import { NavItem, NavLink, NavbarBrand } from 'react-bootstrap';
import { NavLink as Link } from 'react-router';

import { faHome } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export const BrandIcon = props => (
  <div {...props} className="brand-icon">
    <img src="content/images/logo-jhipster.png" alt="Logo" />
  </div>
);

export const Brand = () => (
  <NavbarBrand as={Link as any} to="/" className="brand-logo">
    <BrandIcon />
    <span className="brand-title">Beefcare</span>
    <span className="navbar-version">{VERSION.toLowerCase().startsWith('v') ? VERSION : `v${VERSION}`}</span>
  </NavbarBrand>
);

export const Home = () => (
  <NavItem>
    <NavLink as={Link as any} to="/" className="d-flex align-items-center">
      <FontAwesomeIcon icon={faHome} />
      <span>Trang chủ</span>
    </NavLink>
  </NavItem>
);
