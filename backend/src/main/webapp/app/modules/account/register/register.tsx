import React, { useEffect, useState } from 'react';
import { Alert, Button, Col, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isEmail } from 'react-jhipster';
import { Link } from 'react-router';

import { toast } from 'react-toastify';

import { useAppDispatch, useAppSelector } from 'app/config/store';
import PasswordStrengthBar from 'app/shared/layout/password/password-strength-bar';

import { handleRegister, reset } from './register.reducer';

export const RegisterPage = () => {
  const [password, setPassword] = useState('');
  const dispatch = useAppDispatch();

  useEffect(
    () => () => {
      dispatch(reset());
    },
    [],
  );

  const handleValidSubmit = ({ username, email, firstPassword }: Record<string, any>) => {
    dispatch(handleRegister({ login: username, email, password: firstPassword, langKey: 'en' }));
  };

  const updatePassword = event => setPassword(event.target.value);

  const successMessage = useAppSelector(state => state.register.successMessage);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage);
    }
  }, [successMessage]);

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h1 id="register-title" data-cy="registerTitle">
            Đăng ký
          </h1>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          <ValidatedForm id="register-form" onSubmit={handleValidSubmit}>
            <ValidatedField
              name="username"
              label="Tên tài khoản"
              placeholder="Nhập tên tài khoản của bạn"
              validate={{
                required: { value: true, message: 'Bạn phải nhập tên tài khoản.' },
                pattern: {
                  value: /^[a-zA-Z0-9!$&*+=?^_`{|}~.-]+@[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*$|^[_.@A-Za-z0-9-]+$/,
                  message: 'Your username is invalid.',
                },
                minLength: { value: 1, message: 'Tên tài khoản phải có ít nhất 1 ký tự.' },
                maxLength: { value: 50, message: 'Tên tài khoản không được vượt quá 50 ký tự.' },
              }}
              data-cy="username"
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
            <ValidatedField
              name="firstPassword"
              label="Mật khẩu mới"
              placeholder="Nhập mật khẩu mới"
              type="password"
              onChange={updatePassword}
              validate={{
                required: { value: true, message: 'Bạn phải nhập mật khẩu.' },
                minLength: { value: 4, message: 'Mật khẩu phải có ít nhất 4 ký tự.' },
                maxLength: { value: 50, message: 'Mật khẩu không được vượt quá 50 ký tự.' },
              }}
              data-cy="firstPassword"
            />
            <PasswordStrengthBar password={password} />
            <ValidatedField
              name="secondPassword"
              label="Xác nhận mật khẩu mới"
              placeholder="Nhập lại mật khẩu mới"
              type="password"
              validate={{
                required: { value: true, message: 'Bạn phải nhập lại mật khẩu để xác nhận.' },
                minLength: { value: 4, message: 'Mật khẩu phải có ít nhất 4 ký tự.' },
                maxLength: { value: 50, message: 'Mật khẩu không được vượt quá 50 ký tự.' },
                validate: v => v === password || 'Xác nhận mật khẩu không khớp!',
              }}
              data-cy="secondPassword"
            />
            <Button id="register-submit" color="primary" type="submit" data-cy="submit">
              Đăng ký
            </Button>
          </ValidatedForm>
          <p>&nbsp;</p>
          <Alert variant="warning">
            <span>Nếu bạn muốn </span>
            <Link to="/login" className="alert-link">
              đăng nhập
            </Link>
            <span>
              , bạn có thể thử với tài khoản mặc định:
              <br />- Quản trị viên (tài khoản=&quot;admin&quot; và mật khẩu=&quot;admin&quot;) <br />- Người dùng (tài
              khoản=&quot;user&quot; và mật khẩu=&quot;user&quot;).
            </span>
          </Alert>
        </Col>
      </Row>
    </div>
  );
};

export default RegisterPage;
