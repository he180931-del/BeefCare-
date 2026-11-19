import React, { useEffect, useState } from 'react';
import { Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm } from 'react-jhipster';
import { useSearchParams } from 'react-router';

import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import PasswordStrengthBar from 'app/shared/layout/password/password-strength-bar';
import { handlePasswordResetFinish, reset } from '../password-reset.reducer';

export const PasswordResetFinishPage = () => {
  const dispatch = useAppDispatch();

  const [searchParams] = useSearchParams();
  const key = searchParams.get('key');

  const [password, setPassword] = useState('');

  useEffect(
    () => () => {
      dispatch(reset());
    },
    [],
  );

  const handleValidSubmit = ({ newPassword }: Record<string, any>) => dispatch(handlePasswordResetFinish({ key: key!, newPassword }));

  const updatePassword = event => setPassword(event.target.value);

  const getResetForm = () => {
    return (
      <ValidatedForm onSubmit={handleValidSubmit}>
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
          data-cy="resetPassword"
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
          data-cy="confirmResetPassword"
        />
        <Button variant="success" type="submit" data-cy="submit">
          Kiểm tra mật khẩu mới
        </Button>
      </ValidatedForm>
    );
  };

  const successMessage = useAppSelector(state => state.passwordReset.successMessage);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage);
    }
  }, [successMessage]);

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="4">
          <h1>Đặt lại mật khẩu</h1>
          <div>{key && getResetForm()}</div>
        </Col>
      </Row>
    </div>
  );
};

export default PasswordResetFinishPage;
