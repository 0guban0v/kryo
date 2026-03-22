# syntax = docker/dockerfile:1

ARG RUBY_VERSION=3.4.5
FROM docker.io/library/ruby:$RUBY_VERSION-slim AS base

WORKDIR /rails

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libsqlite3-0 libvips libjemalloc2 ffmpeg redis procps && \
    ln -s /usr/lib/$(uname -m)-linux-gnu/libjemalloc.so.2 /usr/local/lib/libjemalloc.so && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archive

ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development" \
    LD_PRELOAD="/usr/local/lib/libjemalloc.so"

FROM base AS build

RUN apt-get update -qq && \
    apt-get install -y build-essential git pkg-config libssl-dev libyaml-dev && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

ENV BUNDLE_DEPLOYMENT="0" \
    BUNDLE_FROZEN="0"

COPY once-campfire/Gemfile once-campfire/Gemfile.lock once-campfire/vendor ./

# Campfire runs Rails main, which expects msgpack support for Action Cable.
# Inject the gem at image-build time so the sibling once-campfire checkout stays untouched.
RUN bundle add msgpack --version ">= 1.7.0" && \
    bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git

COPY once-campfire /rails

RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

FROM base

ARG OCI_DESCRIPTION
LABEL org.opencontainers.image.description="${OCI_DESCRIPTION}"
ARG OCI_SOURCE
LABEL org.opencontainers.image.source="${OCI_SOURCE}"
LABEL org.opencontainers.image.licenses="MIT"

RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash
USER 1000:1000

ENV HTTP_IDLE_TIMEOUT=60
ENV HTTP_READ_TIMEOUT=300
ENV HTTP_WRITE_TIMEOUT=300

COPY --from=build --chown=rails:rails /usr/local/bundle /usr/local/bundle
COPY --from=build --chown=rails:rails /rails /rails

ARG APP_VERSION
ENV APP_VERSION=$APP_VERSION
ARG GIT_REVISION
ENV GIT_REVISION=$GIT_REVISION

EXPOSE 80 443

CMD ["bin/boot"]
