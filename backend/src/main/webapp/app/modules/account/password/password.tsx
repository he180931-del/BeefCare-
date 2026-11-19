import React, { useEffect, useState } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';

import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import PasswordStrengthBar from 'app/shared/layout/password/password-strength-bar';
import { getSession } from 'app/shared/reducers/authentication';

import { reset, savePassword } from './password.reducer';

export const PasswordPage = () => {
  const [password, setPassword] = useState('');
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(reset());
    dispatch(getSession());
    return () => {
      dispatch(reset());
    };
  }, []);

  const handleValidSubmit = ({ currentPassword, newPassword }: Record<string, any>) => {
    dispatch(savePassword({ currentPassword, newPassword }));
  };

  const updatePassword = event => setPassword(event.target.value);

  const account = useAppSelector(state => state.authentication.account);
  const successMessage = useAppSelector(state => state.password.successMessage);
  const errorMessage = useAppSelector(state => state.password.errorMessage);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage);
    } else if (errorMessage) {
      toast.error(errorMessage);
    }
    dispatch(reset());
  }, [successMessage, errorMessage]);

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h2 id="password-title">
            Mật khẩu cho tài khoản [<strong>{account.login}</strong>]
          </h2>
          <ValidatedForm id="password-form" onSubmit={handleValidSubmit}>
            <ValidatedField
              name="currentPassword"
              label="Current password"
              placeholder="Current password"
              type="password"
              validate={{
                required: { value: true, message: 'Bạn phải nhập mật khẩu.' },
              }}
              data-cy="currentPassword"
            />
            <ValidatedField
              name="newPassword"
              label="Mật khẩu mới"
              placeholder="Nhập mật khẩu mới"
              type="password"
              validate={{
                required: { value: true, message: 'Bạn phải nhập mật khẩu.' },
                minLength: { value: 4, message: 'Mật khẩu phải có ít nhất 4 ký tự.' },
                maxLength: { value: 50, message: 'Mật khẩu không được vượt quá 50 ký tự.' },
              }}
              onChange={updatePassword}
              data-cy="newPassword"
            />
            <PasswordStrengthBar password={password} />
            <ValidatedField
              name="confirmPassword"
              label="Xác nhận mật khẩu mới"
              placeholder="Nhập lại mật khẩu mới"
              type="password"
              validate={{
                required: { value: true, message: 'Bạn phải nhập lại mật khẩu để xác nhận.' },
                minLength: { value: 4, message: 'Mật khẩu phải có ít nhất 4 ký tự.' },
                maxLength: { value: 50, message: 'Mật khẩu không được vượt quá 50 ký tự.' },
                validate: v => v === password || 'Xác nhận mật khẩu không khớp!',
              }}
              data-cy="confirmPassword"
            />
            <Button variant="success" type="submit" data-cy="submit">
              Lưu
            </Button>
          </ValidatedForm>
        </Col>
      </Row>
    </div>
  );
};

export default PasswordPage;
