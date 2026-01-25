#!/bin/bash
echo "Starting Docker environment..."
docker-compose up -d

echo "Waiting for services to be ready..."
sleep 5

echo "Environment ready!"
echo "Use the following environment variables for testing:"
echo ""
echo "export SFTP_TEST_HOP_HOST=localhost"
echo "export SFTP_TEST_HOP_PORT=2222"
echo "export SFTP_TEST_HOP_USER=jumpuser"
echo "export SFTP_TEST_HOP_PASS=password123"
echo "export SFTP_TEST_TARGET_HOST=sftp-target-host"
echo "export SFTP_TEST_TARGET_USER=targetuser"
echo "export SFTP_TEST_TARGET_PASS=password456"
echo ""
echo "Run tests with: npm test"
