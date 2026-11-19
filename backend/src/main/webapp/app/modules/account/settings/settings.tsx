import React, { useEffect } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isEmail } from 'react-jhipster';

import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { getSession } from 'app/shared/reducers/authentication';

import { reset, saveAccountSettings } from './settings.reducer';

export const SettingsPage = () => {
  const dispatch = useAppDispatch();
  const account = useAppSelector(state => state.authentication.account);
  const successMessage = useAppSelector(state => state.settings.successMessage);

  useEffect(() => {
    dispatch(getSession());
    return () => {
      dispatch(reset());
    };
  }, []);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage);
    }
  }, [successMessage]);

  const handleValidSubmit = values => {
    dispatch(
      saveAccountSettings({
        ...account,
        ...values,
      }),
    );
  };

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="settings-title">
            Cài đặt người dùng của [<strong>{account.login}</strong>]
          </h2>
          <ValidatedForm id="settings-form" onSubmit={handleValidSubmit} defaultValues={account}>
            <ValidatedField
              name="firstName"
              label="Tên"
              id="firstName"
              placeholder="Nhập tên của bạn"
              validate={{
                required: { value: true, message: 'Bạn phải nhập tên.' },
                minLength: { value: 1, message: 'Tên phải có ít nhất 1 ký tự' },
                maxLength: { value: 50, message: 'Tên không được vượt quá 50 ký tự' },
              }}
              data-cy="firstname"
            />
            <ValidatedField
              name="lastName"
              label="Họ"
              id="lastName"
              placeholder="Nhập họ của bạn"
              validate={{
                required: { value: true, message: 'Bạn phải nhập họ tên.' },
                minLength: { value: 1, message: 'Họ tên phải có ít nhất 1 ký tự' },
                maxLength: { value: 50, message: 'Họ tên không được vượt quá 50 ký tự' },
              }}
              data-cy="lastname"
            />
            <ValidatedField
              name="email"
              label="Email"
              placeholder="Nhập email của bạn"
              type="email"
              validate={{
                required: { value: true, message: 'Bạn phải nhập email.' },
                minLength: { value: 5, message: 'Email phải có ít nhất 5 ký tự.' },
                maxLength: { value: 254, message: 'Email không được vượt quá 50 ký tự.' },
                validate: v => isEmail(v) || 'Email bạn nhập không hợp lệ.',
              }}
              data-cy="email"
            />
            <Button variant="primary" type="submit" data-cy="submit">
              Lưu
            </Button>
          </ValidatedForm>
        </Col>
      </Row>
    </div>
  );
};

export default SettingsPage;
