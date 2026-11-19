import React, { useEffect } from 'react';
import { Alert, Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isEmail } from 'react-jhipster';

import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import { handlePasswordResetInit, reset } from '../password-reset.reducer';

export const PasswordResetInit = () => {
  const dispatch = useAppDispatch();

  useEffect(
    () => () => {
      dispatch(reset());
    },
    [],
  );

  const handleValidSubmit = ({ email }: Record<string, any>) => {
    dispatch(handlePasswordResetInit(email));
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
        <Col md="8">
          <h1>Đặt lại mật khẩu của bạn</h1>
          <Alert variant="warning">
            <p>Nhập địa chỉ email mà bạn đã sử dụng để đăng ký</p>
          </Alert>
          <ValidatedForm onSubmit={handleValidSubmit}>
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
              data-cy="emailResetPassword"
            />
            <Button variant="primary" type="submit" data-cy="submit">
              Đặt lại mật khẩu
            </Button>
          </ValidatedForm>
        </Col>
      </Row>
    </div>
  );
};

export default PasswordResetInit;
