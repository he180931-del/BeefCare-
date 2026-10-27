import React, { useEffect } from 'react';
import { Button, Col, FormText, Row } from 'react-bootstrap';
import { ValidatedField, ValidatedForm, isEmail } from 'react-jhipster';
import { Link, useNavigate, useParams } from 'react-router';

import { faArrowLeft, faSave } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { useAppDispatch, useAppSelector } from 'app/config/store';

import { createUser, getRoles, getUser, reset, updateUser } from './user-management.reducer';

export const UserManagementUpdate = () => {
  const dispatch = useAppDispatch();

  const navigate = useNavigate();

  const { login } = useParams<'login'>();
  const isNew = login === undefined;

  useEffect(() => {
    if (isNew) {
      dispatch(reset());
    } else {
      dispatch(getUser(login));
    }
    dispatch(getRoles());
    return () => {
      dispatch(reset());
    };
  }, [login]);

  const handleClose = () => {
    navigate('/admin/user-management');
  };

  const saveUser = values => {
    if (isNew) {
      dispatch(createUser(values));
    } else {
      dispatch(updateUser(values));
    }
    handleClose();
  };

  const user = useAppSelector(state => state.userManagement.user);
  const loading = useAppSelector(state => state.userManagement.loading);
  const updating = useAppSelector(state => state.userManagement.updating);
  const authorities = useAppSelector(state => state.userManagement.authorities);

  return (
    <div>
      <Row className="justify-content-center">
        <Col md="8">
          <h1 data-cy="UserManagementCreateUpdateHeading">Tạo hoặc sửa tài khoản</h1>
        </Col>
      </Row>
      <Row className="justify-content-center">
        <Col md="8">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <ValidatedForm onSubmit={saveUser} defaultValues={user}>
              {user.id && <ValidatedField type="text" name="id" data-cy="id" required readOnly label="ID" validate={{ required: true }} />}
              <ValidatedField
                type="text"
                name="login"
                data-cy="login"
                label="Tên đăng nhập"
                validate={{
                  required: {
                    value: true,
                    message: 'Bạn phải nhập tên tài khoản.',
                  },
                  pattern: {
                    value: /^[a-zA-Z0-9!$&*+=?^_`{|}~.-]+@[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*$|^[_.@A-Za-z0-9-]+$/,
                    message: 'Your username is invalid.',
                  },
                  minLength: {
                    value: 1,
                    message: 'Tên tài khoản phải có ít nhất 1 ký tự.',
                  },
                  maxLength: {
                    value: 50,
                    message: 'Tên tài khoản không được vượt quá 50 ký tự.',
                  },
                }}
              />
              <ValidatedField
                type="text"
                name="firstName"
                data-cy="firstName"
                label="Tên"
                validate={{
                  maxLength: {
                    value: 50,
                    message: 'Trường này không được vượt quá 50 ký tự.',
                  },
                }}
              />
              <ValidatedField
                type="text"
                name="lastName"
                data-cy="lastName"
                label="Họ"
                validate={{
                  maxLength: {
                    value: 50,
                    message: 'Trường này không được vượt quá 50 ký tự.',
                  },
                }}
              />
              <FormText>This field cannot be longer than 50 characters.</FormText>
              <ValidatedField
                name="email"
                data-cy="email"
                label="Email"
                placeholder="Nhập email của bạn"
                type="email"
                validate={{
                  required: {
                    value: true,
                    message: 'Bạn phải nhập email.',
                  },
                  minLength: {
                    value: 5,
                    message: 'Email phải có ít nhất 5 ký tự.',
                  },
                  maxLength: {
                    value: 254,
                    message: 'Email không được vượt quá 50 ký tự.',
                  },
                  validate: v => isEmail(v) || 'Email bạn nhập không hợp lệ.',
                }}
              />
              <ValidatedField
                type="checkbox"
                name="activated"
                data-cy="activated"
                check
                value={true}
                disabled={!user.id}
                label="Kích hoạt"
              />
              <ValidatedField type="select" name="authorities" data-cy="profiles" multiple label="Các quyền">
                {authorities.map(role => (
                  <option value={role} key={role}>
                    {role}
                  </option>
                ))}
              </ValidatedField>
              <Button as={Link as any} to="/admin/user-management" replace variant="info" data-cy="entityCreateCancelButton">
                <FontAwesomeIcon icon={faArrowLeft} />
                &nbsp;
                <span className="d-none d-md-inline">Quay lại</span>
              </Button>
              &nbsp;
              <Button variant="primary" type="submit" disabled={updating} data-cy="entityCreateSaveButton">
                <FontAwesomeIcon icon={faSave} />
                &nbsp; Lưu
              </Button>
            </ValidatedForm>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default UserManagementUpdate;
